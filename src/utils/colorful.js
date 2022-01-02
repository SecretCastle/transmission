/**
 * @author SecretCastle
 * @email henrychen9314@gmail.com
 * @create date 2022-01-01 12:30:39
 * @modify date 2022-01-01 15:35:17
 * @desc 多彩颜色
 */

const colors = require('colors/safe')

/**
 * 成功
 * @param {*} result 
 * @param {*} bold 是否加粗显示
 */
const success = (result, bold) => {
    if (bold) {
        console.log(colors.green.bold(result))
    } else {
        console.log(colors.green(result))
    }
}

/**
 * 警告
 * @param {*} result 
 * @param {*} bold 是否加粗显示
 */
const warn = (result, bold) => {
    if (bold) {
        console.log(colors.yellow.bold(result))
    } else {
        console.log(colors.yellow(result))
    }
}

/**
 * 失败
 * @param {*} result 
 * @param {*} bold 是否加粗显示
 */
const error = (result, bold) => {
    if (bold) {
        console.log(colors.red.bold(result))
    } else {
        console.log(colors.red(result))
    }
}

/**
 * 失败
 * @param {*} result 
 * @param {*} bold 是否加粗显示
 */
 const info = (result, bold) => {
    if (bold) {
        console.log(colors.yellow.bold(result))
    } else {
        console.log(colors.yellow(result))
    }
}

module.exports = {
    success,
    warn,
    error,
    info
}