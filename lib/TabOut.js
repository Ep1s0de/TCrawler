const dashService = require('../services/dashService');

const app = require("../main");
const axios = require('axios');
const fs = require("fs");
const fetch = require("node-fetch");
const FormData = require("form-data");

let balance = 0;
let fail = false

function delay(time) {
  return new Promise(function(resolve) {
    setTimeout(resolve, time);
  });
};

module.exports = class Tab {
  constructor(page, session, headers, restartTab) {
    this.page = page;
    this.session = session;
    this.restartTab = restartTab;
    this.headers = headers;
  }

  async prepare() {
    await this.page.setRequestInterception(true);
    await this.page._client().send('Network.enable', {
      maxResourceBufferSize: 1680 * 1050 * 100,
      maxTotalBufferSize: 1024 * 1204 * 200,
    });

    this.page.setDefaultNavigationTimeout(10000);

    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36');

    this.page.on("pageerror", err => {
      console.error(`Page error emitted: "${err.message}"`);
    });

    await this.page.on("response", async response => {

      const req = await response.request();
      if (req.url().startsWith(process.env.TINK_BALANCE_CHECK_START_WITH)) {
        balance = 0
        let filtredData = [];
        let text = await response.text();
        let data = JSON.parse(text);

        try {
          data.payload.forEach((row) => {
            if(row.moneyAmount?.value && row.moneyAmount.value  > 0 && row.accountType === 'Current'){
              balance += row.moneyAmount.value;
              this.sendLogs(`${app.configs.crawler.name}: Баланс ${balance} руб.`);
            }
          });
        }
        catch (e) {
          console.log(e);
        }

      }
    });

    this.page.on("response", res => {
      if (!res.ok() && res.status() > 400) {
        console.error(
            `Non-200 response from this request: [${res.status()}] "${res.url()}"`
        );
      }
    });

    this.page.on("request", request => {
      const resources = ["image", "font"];

      if (resources.includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    this.page.on("console", async msg => {
      const msgArgs = msg.args();
      for (let i = 0; i < msgArgs.length; ++i) {
      }
    });
  }

  async sendLogs(text){
    let messageLink = `https://api.telegram.org/bot${process.env.tlgApi}/sendMessage?chat_id=${process.env.chatId}&text=${text}`
    try{
      await axios.get(messageLink);
    }
    catch (e) {
      console.log(e);
    }
  }

  async navigateToWithdrawPage() {

    await this.page.goto(process.env.TINK_WITHDRAW_PAGE_URL, {
      waitUntil: "domcontentloaded"
    });

    try {
      await this.page.waitForSelector('[data-qa-file="InputCard"]');
    }
    catch (e){
      console.log(e)
    }


  }
  async awaitForOtp() {
    await this.clearOtp()
    let count = 0
    let codeResentCount = 0
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        if (app.otp.currentWithdrawOtp) {
          clearInterval(interval);
          return resolve(app.otp.currentWithdrawOtp);
        } else {
          count += 1
          if(codeResentCount >= 3){
            clearInterval(interval);
            fail = true;
            return resolve();
          }
          // CHECK IF 1 MINUTE PASSED
          if(count > 120 && !app.otp?.currentWithdrawOtp){
            await this.clearOtp()
            let codeResendBtn = await this.page.$('[class^="Link-module_"]');
            await codeResendBtn.click();
            await this.sendLogs(`${app.configs.crawler.name}: Запрашиваю код заново`);
            codeResentCount += 1
            count = 0;
          }
        }
      }, 1000);
    });
  }
  async clearOtp(){
    return app.otp.removeCurrentWithdrawOtp()
  }
  async startCrawling() {
    try {
      this.session?.emitToSockets("notification", {
        message: "Establishing connection with..."
      });

      this.session?.emitToSockets("notification", {
        message: "Authenticated successfully!"
      });

      await this.sendLogs(`${app.configs.crawler.name}: Иду на странцу переводов`);
      await this.crawl();
      await this.sendLogs(`${app.configs.crawler.name}: Начитаю мониторинг баланса`);
    } catch (err) {
      console.log(err);
      if (err?.name.includes("TimeoutError")) {
        await this.page.screenshot({path: 'error6.png'});
        await this.sendScreenshots('./error6.png', false);

        await this.page.startCrawling();
      }
    }
  }

  async getScreenshot(userId){
    await this.page.screenshot({path: 'getScreenshot1.png'});
    await delay(2000)
    await this.page.click('[class^="ContextMenuForGetReceiptButton"]');
    await this.page.screenshot({path: 'getScreenshot2.png'});
    await delay(500)
    await this.page.click('[class^="ContextMenu-module__listItem_"]');

    // await butns[0].click();
    await this.page.screenshot({path: 'getScreenshot3.png'});

    await delay(3000);
    await this.sendScreenshots('./checks/download.pdf', userId);
    await this.sendScreenshots('./checks/download.pdf', false);


    await delay(11000)

    await fs.unlinkSync('checks/download.pdf');

    return true
  }

  async withDraw(withDrawValue) {
    await this.clearOtp();
    await delay(2000)
    await this.navigateToWithdrawPage()
    await this.page.screenshot({path: 'START_WITHDRAW.png'});

    let cardData = await dashService.getWithdrawCard();
    if(cardData === null){
      await this.sendLogs(`${app.configs.crawler.name}: \n Запрос на получение карты вывода не сработал. Проверьте ошибки`);
      await this.page.goto(process.env.TINK_MYB_URL);
      await delay(2000)
      return  null
    }
    let done = false
    await this.sendLogs(`${app.configs.crawler.name}: Начинаю вывод`);

    await this.page.screenshot({path: '1.png'});
    await this.page.click('[id^=InputCard_]')
    await this.page.screenshot({path: '2.png'});

    await delay(1000)

    await this.page.type('[id^=InputCard_]', cardData.card, { delay: 200 });
    await this.page.screenshot({path: '3.png'});


    await delay(1000);


    await this.page.screenshot({path: '4.png'});


    await this.page.type(`[name="moneyAmount"]`, `${withDrawValue}`, { delay: 200 })
    await this.page.screenshot({path: '5.png'});


    await this.page.screenshot({path: 'WRITE_DATA_DONE.png'});
    await delay(1000);

    await this.page.click('[data-qa-file="SubmitButton"]')
    await this.page.screenshot({path: '6.png'});


    await delay(1000);

    await this.sendLogs(`${app.configs.crawler.name}: Ввел все данные`);

    await this.page.screenshot({path: 'AFTER_SUBMIT.png'});

    try {
      await this.page.screenshot({path: 'WAIT_SMS_CODE.png'});
      await this.page.waitForSelector('[name="code"]');
      await this.sendLogs(`${app.configs.crawler.name}: \n Нужно ввести СМС код.`);
      let otp = await this.awaitForOtp();
      if(fail === true){
        await this.page.screenshot({path: 'FAIL_SMS_CODE.png'});
        await this.sendScreenshots('./FAIL_SMS_CODE.png', false);
        await this.sendLogs(`${app.configs.crawler.name}: \n Вывод не удался. Код не приходит`);
        await this.page.goto(process.env.TINK_MYB_URL);
        await delay(2000)
        await dashService.sendWithdrawStatus({
          merchant_id: cardData.merchant_id,
          amount: withDrawValue,
          card: cardData.card,
          currency: cardData.currency,
          status: 'error'
        })
        return null
      }
      await this.page.click('[name="code"]')
      await this.sendLogs(`${app.configs.crawler.name}: \n Вводим код`);
      await this.page.type('[name="code"]', otp, { delay: 200 })
      await this.page.screenshot({path: 'write-sms-code.png'});
      await this.clearOtp();
      try {
        await this.page.waitForSelector('[data-qa-file="UIPaymentSuccess"]');
        done = true
        await this.page.screenshot({path: 'DONE.png'});
      }
      catch (e) {
        console.log(e)
      }
    }
    catch (e){
      console.log(e)
      await this.clearOtp();
    }
    if(done === false){
      try {
        await this.page.waitForSelector('[data-qa-file="UIPaymentSuccess"]');
        done = true
        await this.page.screenshot({path: 'DONE.png'});
      }
      catch (e) {
        console.log(e)
      }
    }

    if(done === false){
      try {
        await this.page.waitForSelector('[type="submit"]')
        await this.page.click('[id="confirmation-question-input"]')
        await this.page.type('[id="confirmation-question-input"]', `Катя`, { delay: 200 })
        await this.page.click('[type="submit"]')
        done = true
        await this.page.screenshot({path: 'question-done.png'});
      }
      catch (e) {
        console.log(e)
      }
    }
    if(done === false){
      try {
        await this.page.waitForSelector('[data-qa-file="UIPaymentSuccess"]');
        done = true
        await this.page.screenshot({path: 'DONE.png'});
      }
      catch (e) {
        console.log(e)
      }
    }

    if (done === true){
      await dashService.sendWithdrawStatus({
        merchant_id: cardData.merchant_id,
        amount: withDrawValue,
        card: cardData.card,
        currency: cardData.currency,
        status: 'success'
      })
      await this.sendLogs(`${app.configs.crawler.name}: \n Перевели на карту ${cardData.card} \n ${withDrawValue} руб.`);
      await this.getScreenshot(cardData.merchant_tel_id)
      await this.page.goto(process.env.TINK_MYB_URL);
      await delay(2000)
      return  null
    }
    else {
      await dashService.sendWithdrawStatus({
        merchant_id: cardData.merchant_id,
        amount: withDrawValue,
        card: cardData.card,
        currency: cardData.currency,
        status: 'error'
      })
      await this.page.screenshot({path: 'error5.png'});
      await this.sendScreenshots('./error5.png', false);
      await this.page.goto(process.env.TINK_MYB_URL);
      await delay(2000)
      return  null
    }
  }

  async crawl() {
    if (this.page.isClosed()) {
      await this.page.screenshot({path: 'error6.png'});
      await this.sendScreenshots('./error6.png', false);
      await app.tab.restartCrawl()
      return null
    }
    else {
      let withdrowValue = await dashService.getWithdrawValue()
      setTimeout(async () => {
        if (balance > withdrowValue && withdrowValue !== null){
          try {
            await this.withDraw(withdrowValue)
            return this.crawl()
          }
          catch (e) {
            console.log(e);
            await this.page.goto(process.env.TINK_MYB_URL);
            return this.crawl()
          }

        }
        else{
          try{
            await this.page.goto(process.env.TINK_MYB_URL)
            await this.page.reload();
            return  this.crawl();
          }
          catch (err) {
            await this.page.screenshot({path: 'DROP.png'});
            console.log(err);
            setTimeout(async () => {
              return  this.crawl();
            }, process.env.TINK_CRAWLER_INTERVAL * 1000 * 3)

          }
        }

      }, parseInt(process.env.TINK_CRAWLER_INTERVAL * 1000));
    }
  }

  async stop() {
    const sessionId = Object.keys(app.sessions)[0];
    const session = app.sessions[sessionId];
    await session.tab.close();
  }

  async sendScreenshots(screenshotName, tlgUserid){

    const controller = new AbortController();
    let formdata = new FormData();
    let readStream = fs.createReadStream(screenshotName);
    formdata.append("document", readStream);

    let requestOptions = {
      method: 'POST',
      body: formdata,
      signal: controller.signal,
      keepalive: false,
    };
    try {
      if(tlgUserid){
        await fetch(`https://api.telegram.org/bot${process.env.tlgApiExchangeBot}/sendDocument?chat_id=${tlgUserid}`, requestOptions)
            .then(response => response.text())
        controller.abort();
      } else {
        await fetch(`https://api.telegram.org/bot${process.env.tlgApi}/sendDocument?chat_id=${process.env.chatId}`, requestOptions)
            .then(response => response.text())
        controller.abort()
      }
      return true
    }
    catch (e) {
      console.log(e)
      controller.abort()
      return false
    }

  }

}