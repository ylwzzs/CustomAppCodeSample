const axios = require('axios');
const SuiteConfig = require('../configs/suite_config');

if (typeof localStorage === "undefined" || localStorage === null) {
    var LocalStorage = require('node-localstorage').LocalStorage;
    localStorage = new LocalStorage('./scratch');
    
}

// 判断 token 是否过期
let _isExpire = function (expire_time) {
    let isExpire = true
    const current = Math.floor(Date.now() / 1000);
    isExpire = expire_time < current ? true : false
    console.log('access token 未过有效期')
    return isExpire;
}

module.exports = {

    
    // 设置 suite_ticket
    async setSuiteTicket(suite_ticket) {
        console.log('更新 suite_ticket');

        return Promise.resolve().then(()=>{
            localStorage.setItem('suite_ticket_time',new Date().valueOf() / 1000)
            localStorage.setItem('suite_ticket',suite_ticket)
        })
    },
    // 读取 suite_ticket
    async getSuiteTicket() {
        console.log('读取 suite_ticket')
        let suite_ticket = ''
        let suite_ticket_time = ''
        try {
            suite_ticket = localStorage.getItem('suite_ticket') || ''
            suite_ticket_time = localStorage.getItem('suite_ticket_time') || ''    
        } catch (error) {
            console.log('还没有设置过')
        }
        
        if(suite_ticket){
            console.log('读取 suite_ticket 成功',suite_ticket)
            return Promise.resolve({
                suite_ticket,
                suite_ticket_time
            })
        }
        else{
            return Promise.resolve()
        }
        
    },
    // 读取 suite_access_token
    async getSuiteAccessToken() {

        const suite_id =  SuiteConfig.SuiteID
        const suite_secret =  SuiteConfig.SuiteSecret

        if(!suite_id || !suite_secret) {
            console.error("请在 configs/suite_config.js 中填写 suite_id 和 suite_secret 信息")
            return;
        }
    
        console.log('准备读取 suite_access_token')
        let suite_access_token 
        let suite_access_token_expire_time
        
        try{
            suite_access_token = localStorage.getItem('suite_access_token') || ''
            suite_access_token_expire_time = localStorage.getItem('suite_access_token_expire_time') || ''
        }catch(error){
            console.error('Access token wat not set')
        }

        if(!suite_access_token || _isExpire(suite_access_token_expire_time)){
            console.log('获取 suite_access_token')
            let suite_ticket_res = await this.getSuiteTicket();
            let suite_ticket = suite_ticket_res.suite_ticket

            const post_data = {
                suite_id: SuiteConfig.SuiteID,
                suite_secret: SuiteConfig.SuiteSecret,
                suite_ticket: suite_ticket
            };

            const { data} = await axios.post('https://testapi.work.weixin.qq.com/cgi-bin/service/get_suite_token', post_data);
            const  { suite_access_token,expires_in } = data;
            if (suite_access_token) {
                console.log('获取 suite_access_token 成功',suite_access_token);
                localStorage.setItem('suite_access_token',suite_access_token);
                localStorage.setItem('suite_access_token_expire_time',Math.floor(Date.now() / 1000) + expires_in)
                console.log('更新 suite_access_token 成功');
                return suite_access_token;
            }
            else{
                console.error('获取 suite_access_token 失败');            
                console.error(data);
                return ;
            }
        }
        else {
            console.log(`从缓存中获取 suite access token `);
            console.log(suite_access_token);
            return suite_access_token
        }
        

    },

    // 设置永久授权码（代开发授权凭证）
    async setPermanentCode(temporary_code) {
        console.log('获取 permanent_code')
        let suite_access_token = await this.getSuiteAccessToken();        
        const { data } = await axios.post(`https://qyapi.weixin.qq.com/cgi-bin/service/get_permanent_code?suite_access_token=${suite_access_token}`, {
            auth_code: temporary_code
        });
        const {
            permanent_code,
            dealer_corp_info,
            auth_corp_info,
            auth_user_info
        } = data;

        if(permanent_code){
            console.log('获取 permanent_code 成功');
            console.log('permanent_code',permanent_code);
            console.log('dealer_corp_info',dealer_corp_info);
            console.log('auth_corp_info',auth_corp_info);
            console.log('auth_user_info',auth_user_info);

            let corpid = auth_corp_info.corpid;
            let corporations 
            
            try {
                corporations = JSON.parse(localStorage.getItem('corporations')) || {}
                corporations[corpid] = data
            } catch (error) {
                console.error(error)
            }
            localStorage.setItem('corporations',JSON.stringify(corporations))            
            return data
        }
        else{
            console.error('获取永久授权码失败',data)
        }
    },
    // 读取企业信息
    async getCorpInfo(CorpID) {
        
        let CorpInfo = {}
        try {
            let corporations = JSON.parse(localStorage.getItem('corporations'))
            CorpInfo = corporations[CorpID] || {}

        } catch (error) {
            console.error(error)
        }
        return Promise.resolve(CorpInfo);
    },

    // 读取企业的 access_token
    async getCorpAccessToken(CorpID) {
        
        let CorpInfo = await this.getCorpInfo(CorpID);
        
        let permanent_code = CorpInfo.permanent_code;

        let suite_access_token = await this.getSuiteAccessToken();

        console.log('获取 corp_access_token');
        let {data} = await axios.post(`https://qyapi.weixin.qq.com/cgi-bin/service/get_corp_token?suite_access_token=${suite_access_token}`,{
            permanent_code,
            auth_corpid:CorpID
        });
        let {access_token} = data;
        if(access_token){
            console.log('获取 corp_access_token 成功',access_token);
            return access_token
        }
        else{
            console.error('获取 corp_access_token 失败',data);
            return;
        }
        


    },


}