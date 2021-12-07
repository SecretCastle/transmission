# Transmission

`Node`version must upper `v14.14.0`

## What's this

* sync files to Tencent COS tools
* sync Tencent COS files to local device

## How to install with npm

```bash
npm install transmission
tx -h
```

## Local install and use, follow under five steps

```bash
git clone https://github.com/SecretCastle/transmission.git
cd transmission
npm install
npm link
tx -h
```

## Core step

* init tx

```bash
cd projectRoot
tx init
```

* config tx

```bash
cd projectRoot
tx config <[SecretId|SecretKey|Bucket|Region|StorageClass]> <value>
```

Default value:

`Region`: `ap-nanjing`

`StorageClass`: `STANDARD_IA`



