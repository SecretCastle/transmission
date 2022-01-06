#!/usr/bin/env node

/**
 * @author SecretCastle
 * @email henrychen9314@gmail.com
 * @create date 2021-12-04 22:55:44
 * @modify date 2022-01-06 23:42:12
 * @desc sync files to TencentCOS
 */

const packagePkg = require('../package.json')
const { Command } = require('commander')
const program = new Command();
const {
    checkConfigurationRoot,
    createConfigurationFolder,
    createConfigurationFile,
    checkConfigFile,
    configFileParse,
    writeNecessaryConfig
} = require('./utils/index')
const inquirer = require('inquirer')
const { success, warn, error, info } = require('./utils/colorful')
const ora = require('ora')
// 选项配置
program
    .version(packagePkg.version)

// 展示所有的配置信息
program
    .command('list')
    .description('展示所有的配置信息')
    .action(async () => {
        // 检验是否已创建配置文件目录
        const checkResult = checkConfigurationRoot();
        if (!checkResult) {
            warn('请先初始化')
            return
        }
        const config = await configFileParse()
        info(JSON.stringify(config))
    })

// 配置TencentCOS
program
    .command('config <parameter> <value>')
    .description('配置COS')
    .action(async (parameter, value) => {
        // 检验是否已创建配置文件目录
        const checkResult = checkConfigurationRoot();
        if (!checkResult) {
            warn('请先初始化')
            return
        }
        try {
            const result = writeNecessaryConfig(parameter, value)
            if (result) {
                success(`配置成功`)
            }
        } catch (err) {
            error(err);
        }
    })

// 同步本地文件至TencentCOS
program
    .command('sync')
    .description('同步本地文件到TencentCOS')
    .action(async () => {
        // 检验是否已创建配置文件目录
        const spinner = ora('开始检查配置').start();
        const result = checkConfigurationRoot();
        if (!result) {
            spinner.warn('请先初始化')
            return
        }
        spinner.succeed('检查配置成功')
        const { syncLocalFiles } = require('./utils/core')
        const checkResult = await checkConfigFile()
        if (!checkResult) {
            warn('必填配置信息为空，请使用tx -h来获取帮助信息')
            return
        }
        try {
            spinner.start('开始同步文件')
            const uploadCount = await syncLocalFiles()
            if (uploadCount) {
                spinner.succeed(`共同步${uploadCount}个文件至TencentCOS`)
            } else {
                spinner.warn('无可同步文件')
            }
        } catch (error) {
            spinner.fail('发生错误')
        }
    })

// 拉去TencentCOS至本地
program
    .command('sync-remote')
    .description('拉取TencentCOS到本地')
    .action(async () => {
        // 对于拉去远端COS的文件，可能会存在覆盖原有的已编辑的文件，给出告警
        inquirer.prompt([{
            type: 'list',
            name: 'choice',
            message: '同步远程COS至本地，可能会造成您修改的文件被还原，是否继续?',
            choices: ['Y', 'N']
        }]).then(async (ans) => {
            if (ans.choice === 'N') {
                return
            }
            const spinner = ora('开始检查配置').start();
            // 检验是否已创建配置文件目录
            const result = checkConfigurationRoot();
            if (!result) {
                warn('请先初始化')
                return
            }
            spinner.succeed('检查配置成功')
            const { syncRemoteFiles } = require('./utils/core')
            const checkResult = await checkConfigFile()
            if (!checkResult) {
                warn('必填配置信息为空，请使用tx -h来获取帮助信息')
                return
            }
            try {
                spinner.start('开始同步文件')
                // 继续拉取远端文件
                const downloadCount = await syncRemoteFiles()
                if (downloadCount) {
                    spinner.succeed(`共同步拉取${downloadCount}个文件`)
                } else {
                    spinner.warn('无可同步至本地的文件')
                }
            } catch (error) {
                spinner.fail('发生错误')
            }
        })
    })

// 初始化tx
program
    .command('init')
    .description('初始化TencentCOS')
    .action(async () => {
        try {
            // 检验是否已创建配置文件目录
            const result = checkConfigurationRoot();
            if (!result) {
                // 创建目录
                await createConfigurationFolder()
                // 创建配置文件
                await createConfigurationFile();
                success('初始化完成');
            } else {
                warn('请勿重复初始化')
            }
        } catch (err) {
            error('发生未知错误，请联系开发者', err);
        }
    })
program.parse()
