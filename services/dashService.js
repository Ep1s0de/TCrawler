const app = require("../main");
const axios = require('axios');
const {response} = require("express");
let firstRun = true;

const links = {
  getValue: process.env.GET_VALUE_URL,
  sendStatus: process.env.SEND_STATUS_URL,
  getCard: process.env.GET_CARD_URL,
}

class DashService {
  constructor() {
  }

  async getWithdrawValue(){
    let data = {};
    if(app.configs.card.bankName === 't'){
      data.currency = 'RUB'
    }
    else{
      data.currency = 'KZT'
    }
    try{
      return axios.post(links.getValue, data)
        .then(response => {
          if(response.data.dt_status === 'success' && response.data.limit !== 0){
            return response.data.limit
          }
          return null
        })
        .catch(e => null)
    }
    catch (e) {
      console.log(e);
      return null

    }

  }

  async getWithdrawCard(){
    let data = {};
    if(app.configs.card.bankName === 'tink'){
      data.currency = 'RUB'
    }
    else{
      data.currency = 'KZT'
    }
    try {
      return axios.post(app.configs.settings.cardGetLink, data)
        .then(response => {
          response.data.currency = data.currency
          return response.data
        })
        .catch(e => null)
    } catch (e) {
      console.log(e)
      return null
    }

  }

  async sendWithdrawStatus(data){
    return axios.post(links.sendStatus, data)
      .then(response => {
        return response.data
      });
  }

  async getInfo() {
    return axios.get(process.env.DASHBOARD_LINK + "/info/")
      .then(response => {
        return response.data
      });
  }

}

module.exports = new DashService();
