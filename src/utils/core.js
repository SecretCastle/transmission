/**
 * @author SecretCastle
 * @email henrychen9314@gmail.com
 * @create date 2021-12-05 18:09:28
 * @modify date 2021-12-10 23:04:55
 * @desc 上传和同步
 */

const COS = require('cos-nodejs-sdk-v5')
const fs = require('fs')
const path = require('path')
const { configFileParse } = require('./index')
const { LOOP_IGNORE } = require('../static/common')
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
 * @description 拉取仓库中的文件
 * @returns
 */
const getAllListFromCOS = async () => {
    const config = await configFileParse()
    return new Promise((resolve, reject) => {
        cos.getBucket({
            Bucket: config.Bucket,
            Region: config.Region
        }, (err, data) => {
            if (!err) {
                if (data && data.statusCode === 200) {
                    resolve(data.Contents)
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
 * 检查文件是否需要上传或更新
 * @param {*} curFile 本地文件
 * @returns 
 */
const checkNeedUpload = async (curFile) => {
    // 获取全量列表
    const fullList = await getAllListFromCOS()
    return new Promise((resolve, reject) => {
        // 获取上传对象的md5
        const md5 = curFile.md5 || ''
        // 获取上传对象的Key
        const Key = curFile.absolutePath
        // 检查是否存在已上传过的Key
        const hasUploadBefore = fullList.find(file => Key === ('/' + file.Key))
        if (hasUploadBefore) {
            // 如果存在，则比较md5
            const ETag = hasUploadBefore.ETag
            resolve(`"${md5}"` !== ETag)
        } else {
            // 如果不存在，则返回True，可直接上传
            resolve(true)
        }
    })
}

/**
 * 检查云端文件是否需要下载到本地
 * @param {*} curFile 远端文件
 */
const checkNeedDownload = async (curFile) => {
    // 获取本地的全量文件
    const localFiles = await flattenFolderFiles()
    return new Promise((resolve, reject) => {
        // 获取文件md5
        const md5 = curFile.ETag
        // 获取文件的Key
        const Key = '/' + curFile.Key
        // 检查是否存在相同的文件
        const hasSameFile = localFiles.find(file => file.absolutePath === Key)
        if (hasSameFile) {
            // 如果存在相同的文件，则比较md5，不相同则更新文件
            const localMd5 = `"${hasSameFile.md5}"`
            // 如果md5不相同，则同步更新文件
            resolve(md5 !== localMd5)
        } else {
            // 如果不存在文件，则需要下载
            resolve(true)
        }
    })
}

/**
 * @description 下载/写入文件，并写入
 * @param {*} list 
 * @param {*} type 1 下载 2 上传
 */
const downloadOrUploadFile = async (list, type) => {
    if (!list) return
    // 获取全量列表
    const fullList = await getAllListFromCOS();
    return new Promise((resolve, reject) => {
        const data = []
        // 暂时先一个个文件下载, 使用reduce + promise
        const result = list.reduce((prePromise, cur) => {
            return prePromise.then(async () => {
                // 下载
                if (type === 1) {
                    // 下载路径
                    const downloadPath = path.resolve(process.cwd(), cur.Key)
                    // 解析文件路径，获取前缀
                    const pathParse = path.parse(cur.Key)
                    if (pathParse.dir) {
                        // 如果存在前缀，则创建目录
                        const dir = path.resolve(process.cwd(), pathParse.dir)
                        // 递归创建目录
                        mkDirsSync(dir)
                    }
                    const checkNeedDownloadResult = await checkNeedDownload(cur)
                    if (checkNeedDownloadResult) {
                        // 如果存在需要下载的文件，则执行下载操作
                        // 下载文件
                        return getObject(cur, downloadPath).then(result => {
                            if (result) {
                                data.push(Object.assign({}, cur, { isSuccess: true }))
                            }
                        })
                    } else {
                        return undefined
                    }
                }
                // 上传
                else {
                    // 检查是否需要更新
                    const checkNeedUploadResult = await checkNeedUpload(cur);
                    if (checkNeedUploadResult) {
                        // 如果需要上传，则更新或上传文件
                        // 上传文件
                        return putObject(cur).then(result => {
                            if (result) {
                                data.push(Object.assign({}, cur, { isSuccess: true }))
                            }
                        })
                    } else {
                        return undefined
                    }
                }
            })
        }, Promise.resolve())
        result.then(() => {
            resolve(data)
        }).catch(err => {
            reject(err)
        })
    })
}

/**
 * @description 递归遍历当前文件夹下的所有文件，并拍平成一维数组
 */
const flattenFolderFiles = async () => {
    try {
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
                    // 如果是文件则保存
                    flattenArr.push({
                        Key: item,
                        md5,
                        // 如果传入的路径为根路径，则表示，文件处于根路径下，为了方便校验，跟路径文件都加上'/'
                        absolutePath: root === rootPath ? '/' + item : path.join(root.replace(process.cwd(), ''), item).split(path.sep).join('/'),
                        fullPath: path.join(root, item)
                    })
                }
            }
        }
        // 递归入口
        await loopFile(fList, rootPath)
        return Promise.resolve(flattenArr)
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
        // 递归遍历当前文件夹下的所有文件，并拍平成一维数组
        const flattenList = await flattenFolderFiles()
        // 上传操作，等待返回
        const result = await downloadOrUploadFile(flattenList, 2)
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
        // 获取COS全量数据
        const fullList = await getAllListFromCOS();
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