/**
 * @author SecretCastle
 * @email henrychen9314@gmail.com
 * @create date 2021-12-05 18:09:28
 * @modify date 2021-12-05 23:07:31
 * @desc 上传和同步
 */

const COS = require('cos-nodejs-sdk-v5')
const fs = require('fs')
const path = require('path')
const { configFileParse } = require('./index')
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
const getObject = async (obj) => {
    const config = await configFileParse();
    return new Promise((resolve, reject) => {
        cos.getObject({
            Bucket: config.Bucket,
            Region: config.Region,
            Key: obj.Key,
        }, (err, data) => {
            if (!err) {
                // 同步文件到本地，暂时在cwd路径
                fs.writeFileSync(path.resolve(process.cwd(), obj.Key), data.Body)
                resolve(obj)
            } else {
                reject(err)
            }
        })
    })
}

/**
 * @description 下载文件，并写入
 * @param {*} list 
 */
const downloadFile = (list) => {
    if (!list) return
    return new Promise((resolve, reject) => {
        // 暂时先一个个文件下载, 使用reduce + promise
        const data = []
        const result = list.reduce((prePromise, cur) => {
            return prePromise.then(() => {
                return getObject(cur).then(result => {
                    if (result) {
                        data.push(Object.assign({}, cur, { isSuccess: true }))
                    }
                })
            })
        }, Promise.resolve())
        result.then(() => {
            resolve(data)
        })
    })
}

/**
 * @description 同步本地文件到COS
 */
const syncLocalFiles = () => { }


/**
 * @description 同步远端文件到COS
 */
const syncRemoteFiles = async () => {
    if (!cos) return
    const config = await configFileParse()
    return new Promise((resolve, reject) => {
        cos.getBucket({
            Bucket: config.Bucket,
            Region: config.Region
        }, async (err, data) => {
            if (!err) {
                // 无错，且code为200
                if (data.statusCode === 200) {
                    // 获取文件列表
                    const contents = data.Contents
                    // 暂时写到当前的目录,不区分文件夹
                    // 调用下载文件和写入文件
                    const result = await downloadFile(contents);
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