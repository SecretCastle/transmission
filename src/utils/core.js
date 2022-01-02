/**
 * @author SecretCastle
 * @email henrychen9314@gmail.com
 * @create date 2021-12-05 18:09:28
 * @modify date 2022-01-02 22:46:42
 * @desc 上传和同步核心函数
 */

const COS = require('cos-nodejs-sdk-v5')
const fs = require('fs')
const path = require('path')
const { configFileParse } = require('./index')
const { LOOP_IGNORE, MULTI_UPLOADS_COUNT } = require('../static/common')
const md5 = require('nodejs-md5')
let cos
const initCOS = async () => {
    const config = await configFileParse()
    cos = new COS({
        SecretId: config.SecretId,
        SecretKey: config.SecretKey
    })
}
initCOS()

/**
 * 计算文件的md5值
 * @param {*} filePath 文件路径
 * @returns 
 */
const md5File = (filePath) => {
    return new Promise((resolve, reject) => {
        md5.file.quiet(filePath, (err, data) => {
            if (!err) {
                if (data) {
                    resolve(data)
                } else {
                    reject(false)
                }
            } else {
                reject(err)
            }
        })
    })
}

/**
 * @description 下载文件
 * @param {*} obj 
 * @returns 
 */
const getObject = async (obj, downloadPath) => {
    const config = await configFileParse();
    return new Promise((resolve, reject) => {
        cos.getObject({
            Bucket: config.Bucket,
            Region: config.Region,
            Key: obj.Key,
            Output: fs.createWriteStream(downloadPath)
        }, (err, data) => {
            if (!err) {
                resolve(obj)
            } else {
                reject(err)
            }
        })
    })
}

/**
 * 上传文件
 * @param {*} obj 
 * @returns 
 */
const putObject = async (obj) => {
    // 获取本地配置
    const config = await configFileParse()
    return new Promise((resolve, reject) => {
        // 调用SDK putObject
        cos.putObject({
            Bucket: config.Bucket,
            Region: config.Region,
            StorageClass: config.StorageClass,
            Key: obj.absolutePath,
            Body: fs.createReadStream(path.resolve(process.cwd(), obj.fullPath)),
            ContentLength: fs.statSync(path.resolve(process.cwd(), obj.fullPath)).size
        }, (err, data) => {
            if (!err) {
                if (data.statusCode === 200) {
                    resolve(obj)
                } else {
                    reject(false)
                }
            } else {
                reject(err)
            }
        })
    })
}

/**
 * 递归创建目录
 * @param {*} dirname 
 * @returns 
 */
const mkDirsSync = (dirname) => {
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (mkDirsSync(path.dirname(dirname))) {
            fs.mkdirSync(dirname);
            return true;
        }
    }
}

/**
 * @description 切割数组, 返回一个数组，数组中包含的是以MULTI_UPLOADS_COUNT为长度的数组，用于同时批量上传/批量下载
 * @param {*} list 需要操作的对象 
 * @param {*} type 1 下载 ｜ 2 上传
 * @return result 切割的数组
 */
 const chunk = (list) => {
    const result = new Array()
    const len = list.length
    if (len < MULTI_UPLOADS_COUNT || MULTI_UPLOADS_COUNT < 1) {
        return new Array(list)
    }
    // 取最大切割次数
    var k = Math.ceil(len / MULTI_UPLOADS_COUNT)
    var j = 0
    while (j < k) {
        // 使用Array.prototype.slice
        var splice = list.splice(0, MULTI_UPLOADS_COUNT)
        result.push(splice)
        j++
    }
    return result
}

// create mapHandler
const mapHandler = (item, type) => {
    // 下载
    if (type === 1) {
        // 下载路径
        const downloadPath = path.resolve(process.cwd(), item.Key)
        // 解析文件路径，获取前缀
        const pathParse = path.parse(item.Key)
        if (pathParse.dir) {
            // 如果存在前缀，则创建目录
            const dir = path.resolve(process.cwd(), pathParse.dir)
            // 递归创建目录
            mkDirsSync(dir)
        }
        // 下载文件
        return getObject(item, downloadPath)
    }
    // 上传
    else {
        // 上传文件
        return putObject(item)
    }
}

/**
 * @description 下载/写入文件，并写入
 * @param {*} list 
 * @param {*} type 1 下载 2 上传
 */
const downloadOrUploadFile = async (list, type) => {
    if (!list) return
    // 取前十个，不足十个取全部
    const promiseArr = list.map(item => mapHandler(item, type))
    // 切割
    const chunkArr = chunk(promiseArr)
    return new Promise((resolve, reject) => {
        let count = 0
        // 批量一次请求是个
        const result = chunkArr.reduce((prePromise, cur) => {
            return prePromise.then(() => {
                return Promise.all(cur).then((data) => {
                    // 统计个数
                    count += data.length
                })
            })
        }, Promise.resolve())
        result.then(() => {
            resolve(count)
        }).catch(err => {
            console.log(err);
            reject(err)
        })
    })
}
/**
 * @description 拉取仓库中的文件
 * @returns
 */
const getAllListFromCOS = async () => {
    const config = await configFileParse()
    // 定义一个Map，用于存储全量数据的每一项的值
    // Map<key, content>
    const fileMap = new Map()
    return new Promise((resolve, reject) => {
        cos.getBucket({
            Bucket: config.Bucket,
            Region: config.Region
        }, (err, data) => {
            if (!err) {
                if (data && data.statusCode === 200) {
                    // resolve(data.Contents)
                    const contents = data.Contents
                    contents && contents.forEach((content) => {
                        fileMap.set('/' + content.Key, content)
                    })
                    resolve({ fileMap, list: contents })
                } else {
                    reject(false)
                }
            } else {
                reject(err)
            }
        })
    })
}
/**
 * @description 递归遍历当前文件夹下的所有文件，并拍平成一维数组
 */
const flattenFolderFiles = async () => {
    try {
        // 定义本地文件列表Map, 用于存储
        const fileMap = new Map()
        // 以当前执行的目录为根目录
        const rootPath = process.cwd()
        // 存储的文件
        let flattenArr = []
        // 获取当前目录下的所有文件和文件夹
        const fList = fs.readdirSync(rootPath)
        // 递归获取拍平数据
        const loopFile = async (list, root) => {
            for (let i = 0; i < list.length; i++) {
                const item = list[i]
                // 忽略IGNORE中的文件或文件夹
                if (LOOP_IGNORE.includes(item)) continue
                // 获取当前路径的文件状态，判断是文件夹还是文件
                const fsStat = fs.statSync(path.resolve(root, item))
                // 判断是否为文件夹
                if (fsStat.isDirectory()) {
                    // 如果是文件夹则继续递归
                    const loopList = fs.readdirSync(path.resolve(root, item))
                    await loopFile(loopList, path.resolve(root, item))
                }
                // 判断是否是文件
                else if (fsStat.isFile()) {
                    // 获取上传文件的md5值
                    const md5 = await md5File(path.join(root, item))
                    const absolutePath = root === rootPath ? '/' + item : path.join(root.replace(process.cwd(), ''), item).split(path.sep).join('/')
                    // 如果是文件则保存
                    fileMap.set(absolutePath, {
                        Key: item,
                        md5,
                        absolutePath,
                        fullPath: path.join(root, item)
                    })
                    flattenArr.push({
                        Key: item,
                        md5,
                        // 如果传入的路径为根路径，则表示，文件处于根路径下，为了方便校验，跟路径文件都加上'/'
                        absolutePath,
                        fullPath: path.join(root, item)
                    })
                }
            }
        }
        // 递归入口
        await loopFile(fList, rootPath)
        return Promise.resolve({ fileMap, list: flattenArr })
    } catch (error) {
        return Promise.reject(error)
    }
}
/**
 * @description 获取需要更新/上传的列表
 * @param {*} type 1 下载 ｜ 2 上传
 */
const getNeedUploadOrDownloadFiles = async (type) => {
    const cosData = await getAllListFromCOS()
    // 获取本地的全量文件
    const localFileData = await flattenFolderFiles()
    // 需要更新/上传的列表
    const resultData = []
    // 遍历拍平后的数据，比较是否需要更新或上传
    try {
        if (type === 1) {
            // 下载
            for (let i = 0; i < cosData.list.length; i++) {
                const current = cosData.list[i]
                // 判断COS中是否包含该文件
                if (localFileData.fileMap.has('/' + current.Key)) {
                    // 获取cos对象
                    const cos_data = localFileData.fileMap.get('/' + current.Key)
                    // 获取COS对象的MD5值
                    const md5 = cos_data.md5
                    // 存在, 比较MD5
                    if (`${current.ETag}` !== `"${md5}"`) {
                        // 上传则存入本地对象
                        resultData.push(current)
                    }
                } else {
                    // 不存在的情况下，存入对应的对象
                    resultData.push(current)
                }
            }
        } else {
            // 上传
            for (let i = 0; i < localFileData.list.length; i++) {
                const current = localFileData.list[i]
                // 判断COS中是否包含该文件
                if (cosData.fileMap.has(current.absolutePath)) {
                    // 获取cos对象
                    const cos_data = cosData.fileMap.get(current.absolutePath)
                    // 获取COS对象的MD5值
                    const md5 = cos_data.ETag
                    // 存在, 比较MD5
                    if (`${md5}` !== `"${current.md5}"`) {
                        // 上传则存入本地对象
                        resultData.push(current)
                    }
                } else {
                    // 不存在的情况下，存入对应的对象
                    // 上传则存入本地对象
                    resultData.push(current)
                }
            }
        }
        return Promise.resolve(resultData)
    } catch (error) {
        return Promise.reject(error)
    }

}

/**
 * @description 同步本地文件到COS
 */
const syncLocalFiles = async () => {
    // 测试
    if (!cos) return
    const config = await configFileParse()
    try {
        // 获取需要上传的文件列表 v1.0.2
        const fullList = await getNeedUploadOrDownloadFiles(2)
        // 上传操作，等待返回
        const result = await downloadOrUploadFile(fullList, 2)
        return Promise.resolve(result)
    } catch (error) {
        return Promise.reject(error)
    }
}
/**
 * @description 同步远端文件到COS
 */
const syncRemoteFiles = async () => {
    if (!cos) return
    try {
        // 获取需要下载的文件列表 v1.0.2
        const fullList = await getNeedUploadOrDownloadFiles(1)
        // 下载
        const result = await downloadOrUploadFile(fullList, 1);
        return Promise.resolve(result)
    } catch (error) {
        return Promise.reject(error)
    }
}

module.exports = {
    syncLocalFiles,
    syncRemoteFiles
}