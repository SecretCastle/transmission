/**
 * @author SecretCastle
 * @email henrychen9314@gmail.com
 * @create date 2021-12-04 23:03:49
 * @modify date 2021-12-05 19:24:43
 * @desc 静态常量存储
 */

/**
 * @param SecretId 
 * @param SecretKey
 * @param Bucket 存储桶
 * @param Region 地域
 * @param StorageClass 存储类型，默认低频存储
 */
const CONFIG_PARAMETERS = ['SecretId', 'SecretKey', 'Bucket', 'Region', 'StorageClass']
/**
 * 项目根目录缓存文件夹名称
 */
const LOCAL_CACHE_FOLDER_NAME = '.tx'
/**
 *  TencentCOS配置文件名称
 */ 
const LOCAL_CACHE_CONFIG_FILE_NAME = '.config'
/**
 * 默认的配置文件内容
 */
const defaultConfigFileContent = `# TencentCOS配置信息
# 密钥id，必填项
SecretId=
# 密钥key，必填项
SecretKey=
# 存储桶，必填项
Bucket=
# 地域,默认南京
Region=ap-nanjing
# 存储类型，默认低频存储
StorageClass=STANDARD_IA
`

module.exports = {
    CONFIG_PARAMETERS,
    LOCAL_CACHE_FOLDER_NAME,
    LOCAL_CACHE_CONFIG_FILE_NAME,
    defaultConfigFileContent
}