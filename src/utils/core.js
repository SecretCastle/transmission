/**
 * @author SecretCastle
 * @email henrychen9314@gmail.com
 * @create date 2021-12-05 18:09:28
 * @modify date 2021-12-06 23:44:47
 * @desc 上传和同步
 */

const COS = require('cos-nodejs-sdk-v5')
const fs = require('fs')
const path = require('path')
const { configFileParse } = require('./index')
const { LOOP_IGNORE } = require('../static/common')
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
 * @description 下载/写入文件，并写入
 * @param {*} list 
 * @param {*} type 1 下载 2 上传
 */
const downloadOrUploadFile = (list, type) => {
    if (!list) return
    return new Promise((resolve, reject) => {
        const data = []
        // 暂时先一个个文件下载, 使用reduce + promise
        const result = list.reduce((prePromise, cur) => {
            return prePromise.then(() => {
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
                    // 下载文件
                    return getObject(cur, downloadPath).then(result => {
                        if (result) {
                            data.push(Object.assign({}, cur, { isSuccess: true }))
                        }
                    })
                } 
                // 上传
                else {
                    // 上传文件
                    return putObject(cur).then(result => {
                        if (result) {
                            data.push(Object.assign({}, cur, { isSuccess: true }))
                        }
                    })
                }
            })
        }, Promise.resolve())
        result.then(() => {
            resolve(data)
        })
    })
}

/**
 * @description 递归遍历当前文件夹下的所有文件，并拍平成一维数组
 */
const flattenFolderFiles = () => {
    return new Promise((resolve, reject) => {
        try {
            // 以当前执行的目录为根目录
            const rootPath = process.cwd()
            // 存储的文件
            let flattenArr = []
            // 获取当前目录下的所有文件和文件夹
            const fList = fs.readdirSync(rootPath)
            // 递归获取拍平数据
            // TODO 优化代码
            const loopFile = (list, root) => {
                for (let i = 0; i < list.length; i++) {
                    const item = list[i]
                    // 忽略IGNORE中的文件或文件夹
                    if (LOOP_IGNORE.includes(item)) continue
                    // 获取当前路径的文件状态，判断是文件夹还是文件
                    const fsStat = fs.statSync(path.resolve(root, item))
                    if (fsStat.isDirectory()) {
                        // 如果是文件夹则继续递归
                        const loopList = fs.readdirSync(path.resolve(root, item))
                        loopFile(loopList, path.resolve(root, item))
                    } else if (fsStat.isFile()) {
                        // 如果是文件则保存
                        flattenArr.push({
                            Key: item,
                            absolutePath: path.join(root.replace(process.cwd(), ''), item),
                            fullPath: path.join(root, item)
                        })
                    }
                }
            }
            // 递归入口
            loopFile(fList, rootPath)
            resolve(flattenArr)
        } catch (error) {
            reject(error)
        }
    })
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
    const config = await configFileParse()
    return new Promise((resolve, reject) => {
        // 获取Bucket中的所有文件list
        cos.getBucket({
            Bucket: config.Bucket,
            Region: config.Region
        }, async (err, data) => {
            if (!err) {
                // 无错，且code为200
                if (data.statusCode === 200) {
                    // 获取文件列表
                    const contents = data.Contents
                    // 调用下载文件和写入文件
                    const result = await downloadOrUploadFile(contents, 1);
                    resolve(result)
                } else {
                    reject('拉取远程文件错误!')
                }
            } else {
                reject(err)
            }
        })
    })
}

module.exports = {
    syncLocalFiles,
    syncRemoteFiles
}