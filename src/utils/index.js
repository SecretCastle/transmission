/**
 * @author SecretCastle
 * @email henrychen9314@gmail.com
 * @create date 2021-12-05 17:28:33
 * @modify date 2021-12-06 23:34:49
 * @desc [description]
 */
const path = require('path')
const fs = require('fs')
const readline = require('readline')
const {
    LOCAL_CACHE_FOLDER_NAME,
    LOCAL_CACHE_CONFIG_FILE_NAME,
    CONFIG_PARAMETERS,
    defaultConfigFileContent
} = require('../static/common')

/**
 * @description 检测本地配置文件的目录是否存在
 * @returns boolean
 */
const checkConfigurationRoot = () => {
    // 获取当前运行路径
    const currentRoot = process.cwd()
    // 拼接配置文件路径
    const configPath = path.join(currentRoot, LOCAL_CACHE_FOLDER_NAME)
    // 返回配置文件路径是否存在
    return fs.existsSync(configPath);
}

/**
 * @description 创建目标文件/文件夹
 * @returns Promise
 */
const createConfigurationFolder = () => {
    // 获取当前执行的路径
    const currentRoot = process.cwd()
    return new Promise((resolve, reject) => {
        try {
            // 拼接文件夹路径
            const folderPath = path.join(currentRoot, LOCAL_CACHE_FOLDER_NAME)
            // 创建文件夹
            fs.mkdirSync(folderPath)
            resolve(true)
        } catch (error) {
            reject(error)
        }
    })
}

/**
 * @description 创建配置文件
 * @returns 
 */
const createConfigurationFile = () => {
    const currentRoot = process.cwd()
    return new Promise((resolve, reject) => {
        try {
            // 配置文件的文件夹地址
            const folderPath = path.resolve(currentRoot, LOCAL_CACHE_FOLDER_NAME)
            // 配置文件的地址
            const filePath = path.join(folderPath, LOCAL_CACHE_CONFIG_FILE_NAME)
            // 写入文件
            fs.writeFileSync(filePath, defaultConfigFileContent)
            resolve(true)
        } catch (error) {
            reject(error)
        }
    })
}

/**
 * @description 配置文件的解析
 * @param {*} path 
 * @returns 
 */
const configFileParse = async () => {
    const currentRoot = process.cwd()
    const config = {}
    try {
        // 配置文件的文件夹地址
        const folderPath = path.resolve(currentRoot, LOCAL_CACHE_FOLDER_NAME)
        // 配置文件的地址
        const filePath = path.join(folderPath, LOCAL_CACHE_CONFIG_FILE_NAME)
        // 读取文件
        const fileBodyData = fs.createReadStream(filePath)
        // 逐行读取配置文件信息
        rl = readline.createInterface({
            input: fileBodyData,
            crlfDelay: Infinity
        })
        for await (const line of rl) {
            // 忽略以#开头的注释
            if (line.startsWith('#')) {
                continue
            }
            const splitLine = line.split('=')
            if (splitLine && splitLine.length) {
                config[splitLine[0]] = splitLine[1] || ''
            }
        }
        return Promise.resolve(config)
    } catch (error) {
        console.log('解析配置文件错误', error);
    }
}

/**
 * @description 检查配置文件
 * @returns Promise
 */
const checkConfigFile = async () => {
    const config = await configFileParse()
    // 如果必填配置为空，则抛出异常
    if (!config[CONFIG_PARAMETERS[0]] || !config[CONFIG_PARAMETERS[1]] || !config[CONFIG_PARAMETERS[2]]) {
        return false
    }
    return true;
}

/**
 * 配置信息写入
 * @param {*} parameter 参数名称
 * @param {*} value 参数值
 * @returns 
 */
const writeNecessaryConfig = async (parameter, value) => {
    try {
        // 如果参数名称不包含于静态常量中，则忽略
        if (!CONFIG_PARAMETERS.includes(parameter)) {
            return
        }
        const currentRoot = process.cwd()
        // 配置文件的文件夹地址
        const folderPath = path.resolve(currentRoot, LOCAL_CACHE_FOLDER_NAME)
        // 配置文件的地址
        const filePath = path.join(folderPath, LOCAL_CACHE_CONFIG_FILE_NAME)
        // 获取fs读取流
        const fsReadStream = fs.createReadStream(filePath)
        // 获取fs的写入流
        const fsWriteStream = fs.createWriteStream(filePath + '_cache')
        // 逐行读取配置文件信息
        rl = readline.createInterface({
            input: fsReadStream,
            crlfDelay: Infinity
        })
        for await (const line of rl) {
            // 忽略以#开头的注释
            if (line.startsWith('#')) {
                // 写入注释行
                fsWriteStream.write(line + '\n')
                continue
            }
            const splitLine = line.split('=')
            if (splitLine[0] && splitLine[0] === parameter) {
                // 写入配置行
                fsWriteStream.write(`${splitLine[0]}=${value}\n`)
            } else {
                // 写入其他行
                fsWriteStream.write(line + '\n')
            }
        }
        // 写入流结束
        fsWriteStream.close()
        // 当写入流结束后，开始执行移除和重命名操作
        fsWriteStream.on('close', () => {
            // 移除原有的配置文件
            fs.rmSync(filePath)
            // 重命名缓存文件为新的配置文件
            fs.renameSync(filePath + '_cache', filePath)
            return Promise.resolve(true)
        })
    } catch (error) {
        return Promise.reject(error)
    }
}

module.exports = {
    checkConfigurationRoot,
    createConfigurationFolder,
    createConfigurationFile,
    checkConfigFile,
    configFileParse,
    writeNecessaryConfig
}