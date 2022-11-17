const express = require('express');
const router = express.Router();
const crypto = require('@wecom/crypto');
const getRawBody = require('raw-body');
const xml2js = require('xml2js');
const SuiteConfig = require('../configs/suite_config');
const Token = require('../libs/tokens');


// 把一个 xml 格式化成一个 json
let parseXML = async function (xml) {
    const result = await xml2js.parseStringPromise(xml, { trim: true });
    return formatMessage(result.xml);
}

// 将xml2js解析出来的对象转换成直接可访问的对象
const formatMessage = function (result) {
    const message = {};
    if (typeof result === 'object') {
        for (const key in result) {
            if (!(result[key] instanceof Array) || result[key].length === 0) {
                continue;
            }
            if (result[key].length === 1) {
                const val = result[key][0];
                if (typeof val === 'object') {
                    message[key] = formatMessage(val);
                } else {
                    message[key] = (val || '').trim();
                }
            } else {
                message[key] = result[key].map(function (item) {
                    return formatMessage(item);
                });
            }
        }
    }
    return message;
}

// 指令回调和数据回调 须实现 get 和 post 两种方式，
// get 用于在应用创建、编辑时的验证
// post 用于实际的授权、业务数据回调
const validateCallback = function (req, res, next) {

    // 从 query 中获取相关参数
    console.log('query', req.query);
    const { msg_signature, timestamp, nonce, echostr } = req.query;

    // 重新计算一遍签名
    const signature = crypto.getSignature(SuiteConfig.Token, timestamp, nonce, echostr);
    console.log('signature', signature);

    // 校验签名是否正确
    if (signature === msg_signature) {
        console.info('签名验证成功')
        // 如果签名校验正确，解密 message
        const { message } = crypto.decrypt(SuiteConfig.EncodingAESKey, echostr);
        console.log('message', message);

        // 返回 message 信息
        res.send(message);
    }
    else {
        console.error('签名验证失败')
        // 如果签名校验失败
        res.send('get singnature failed!');
    }
};

// get方式 用于验证
router.get(SuiteConfig.CallBackPath, validateCallback);

// post方式，用于接受实际回调
router.post(SuiteConfig.CallBackPath, async function (req, res, next) {
    console.log('------ Callbak Command ------');

    // 解析 xml 的字符串内容
    let wholeXML = await getRawBody(req, {
        length: req.headers['content-length'],
        limit: '1mb',
        encoding: 'utf-8'
    });
    // 将 xml 解析成 json
    let formatJson = await parseXML(wholeXML);    
    // 将加密消息体进行解密，解密后仍旧是 xml 字符串
    let messageXML = crypto.decrypt(SuiteConfig.EncodingAESKey, formatJson.Encrypt);
    // 把解密后 xml 消息体字符串，解析成 json
    let callbackDataBody = await parseXML(messageXML.message);
    console.log('CallbackData', callbackDataBody);

    const suite_id = callbackDataBody.SuiteId;
    const info_type = callbackDataBody.InfoType;
    console.log('SuiteId', suite_id);
    console.log('InfoType', info_type);
    switch (info_type) {
        // 获取 suite_ticket 推送
        case 'suite_ticket':            
            console.log('SuiteTicket', callbackDataBody.SuiteTicket);
            Token.setSuiteTicket(callbackDataBody.SuiteTicket);
            break;            
        // 新的授权
        case 'reset_permanent_code':
        case 'create_auth':            
            console.log('AuthCode', callbackDataBody.AuthCode);
            Token.setPermanentCode(callbackDataBody.AuthCode);            
            break;
        default:
            break;
    }
    // 很重要，一定要返回 success 字符串
    res.send('success');
});


module.exports = router;