var express = require('express');
var router = express.Router();
var path = require('path');
var axios = require('axios')
var Token = require('../libs/tokens');
const SuiteConfig = require('../configs/suite_config');
var dayjs = require('dayjs')

if (typeof localStorage === "undefined" || localStorage === null) {
  var LocalStorage = require('node-localstorage').LocalStorage;
  localStorage = new LocalStorage('./scratch');  
}


/* GET home page. */
router.get('/', async function(req, res, next) {   
  let suite_ticket_res = await Token.getSuiteTicket()
  let suite_ticket = ''
  let suite_ticket_time = ''
  if(suite_ticket_res){
    suite_ticket = suite_ticket_res.suite_ticket
    suite_ticket_time = dayjs.unix(suite_ticket_res.suite_ticket_time).format('YYYY/MM/DD HH:mm:ss') 
  }
 
  let suite_access_token = localStorage.getItem('suite_access_token') || ''
  let suite_access_token_expire_time = localStorage.getItem('suite_access_token_expire_time') || ''

  if(suite_access_token_expire_time){
    suite_access_token_expire_time = dayjs.unix(suite_access_token_expire_time).format('YYYY/MM/DD HH:mm:ss') 
  }

  let corps = []

  try {
    let corps_JSON = JSON.parse(localStorage.getItem('corporations')) || {}
    console.log(corps_JSON)

    for (const key in corps_JSON) {
      let corp = corps_JSON[key]
      corps.push({
        corp_id:key,
        corp_name : corp.auth_corp_info.corp_name || '',
        permanent_code: corp.permanent_code || '',
        agent_id: corp.auth_info.agent[0].agentid || '',
        auth_user_name: corp.auth_user_info.name || ''
      })
    }


  } catch (error) {
    console.log(error)
  }
  
  res.render('dashboard',{
    suite_config:SuiteConfig,
    suite_ticket,
    suite_ticket_time,
    suite_access_token,
    suite_access_token_expire_time,
    corps
  })  
});

module.exports = router;