#!/usr/bin/env node

/**
 * @author SecretCastle
 * @email henrychen9314@gmail.com
 * @create date 2021-12-04 22:55:44
 * @modify date 2021-12-05 23:08:45
 * @desc sync files to TencentCOS
 */

const package = require('../package.json')
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
const { syncLocalFiles, syncRemoteFiles } = require('./utils/core')

// 选项配置
program
    .version(package.version)

// 展示所有的配置信息
program
    .command('list')
    .description('展示所有的配置信息')
    .action(async () => {
        const config = await configFileParse()
        console.log(JSON.stringify(config))
    })

// 配置TencentCOS
program
    .command('config <parameter> <value>')
    .description('配置COS')
    .action(async (parameter, value) => {
        try {
            const result = writeNecessaryConfig(parameter, value)
            if (result) {
                console.log(`配置成功`)
            }
        } catch (error) {
            console.log(error);
        }
    })

// 同步本地文件至TencentCOS
program
    .command('sync')
    .description('同步本地文件到TencentCOS')
    .action(async () => {
        const checkResult = await checkConfigFile()
        if (!checkResult) {
            console.log('必填配置信息为空，请使用tx -h来获取帮助信息')
            return
        }
    })

// 拉去TencentCOS至本地
program
    .command('sync-remote')
    .description('拉取TencentCOS到本地')
    .action(async () => {
        const checkResult = await checkConfigFile()
        if (!checkResult) {
            console.log('必填配置信息为空，请使用tx -h来获取帮助信息')
            return
        }
        // 对于拉去远端COS的文件，可能会存在覆盖原有的已编辑的文件，给出告警
        inquirer.prompt([{
            type: 'list',
            name: 'choice',
            message: '同步远程COS至本地，可能会造成您修改的文件被还原，是否继续?',
            choices: ['Y', 'N']
        }]).then(async (ans) => {
            if (ans.choice === 'N')  {
                return
            }
            // 继续拉取远端文件
            const result = await syncRemoteFiles()
            if (result && result.length) {
                console.log(`共同步拉取${result.length}个文件`);
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
                console.log('初始化完成');
            } else {
                console.log('请勿重复初始化')
            }
        } catch (error) {
            console.log('发生未知错误，请联系开发者', error);
        }
    })

program.parse()
