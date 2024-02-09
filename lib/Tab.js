const app = require("../main");
const operationsService = require('../services/operations');

const fetch = require("node-fetch");
const fs = require("fs");
const axios = require('axios');
const FormData = require('form-data');

let carvedData = true;
let processActive = false;
let resendCount = 0;
let dataCount = 0;

function delay(time) {
  return new Promise(function (resolve) {
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
      maxResourceBufferSize: 1024 * 1204 * 100,
      maxTotalBufferSize: 1024 * 1204 * 200,
    });

    this.page.setDefaultNavigationTimeout(10000);

    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36');

    this.page.on("pageerror", err => {
      console.error(`Page error emitted: "${err.message}"`);
    });

    this.page.on("response", async res => {
      const req = await res.request();
      if (!res.ok() && res.status() > 400) {
        console.error(
          `Non-200 response from this request: [${res.status()}] "${res.url()}"`
        );
      } else if (req.url().startsWith(process.env.TINK_REQUEST_START_WITH)) {
        let filtredData = [];

        try {
          let text = await res.text();
          let data = JSON.parse(text);

          if (data.payload && data.payload[0] && processActive === false) {
            processActive = true
            data.payload.forEach((row) => {
              let now = new Date();
              filtredData.push({
                group: row.group,
                cardNumber: app.configs.card.cardNumber,
                accountCurrency: row.accountAmount.currency.name ? row.accountAmount.currency.name : null,
                accountValue: row.accountAmount.value ? row.accountAmount.value : null,
                checkuniq: row.account + row.amount.value + row.accountAmount.value + row.type + row.authorizationId,
                tId: row.id,
                bank: app.configs.card.bankName,
                auntId: row.authorizationId,
                operationTime: now.setTime(row.operationTime.milliseconds),
                operationType: row.type,
                currency: row.amount.currency.name ? row.amount.currency.name : null,
                currencyValue: row.amount.value ? row.amount.value : null,
                accountId: row.account,
                isSend: false,
                writeTime: new Date(),
                status: row.status
              });
            });
            dataCount = 0
            await this.saveUnprocessedRow(filtredData);
            await delay(2000);
            processActive = false
          } else {
            dataCount += 1
            if (dataCount >= 2) {
              processActive = false;
            }
          }
        } catch (e) {
          console.log(e);
        }

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
  }

  async sendLogs(text) {
    let messageLink = `https://api.telegram.org/bot${process.env.tlgApi}/sendMessage?chat_id=${process.env.chatId}&text=${text}`
    try {
      await axios.get(messageLink);
    } catch (e) {
      console.log(e);
    }
  }

  async login() {
    await this.page.goto(process.env.TINK_LOGIN_URL, {
      waitUntil: "domcontentloaded"
    });

    await this.clearOtp();

    // await this.sendLogs(`${app.configs.crawler.name}: Начитаю вход`)
    await this.page.screenshot({path: 'start-login.png'});

    let numberInpSelector = `[name="phone"]`;
    let submitBtnSelector = `[type="submit"]`;
    await this.page.waitForSelector(numberInpSelector);
    await this.page.click(numberInpSelector);
    await this.page.type(numberInpSelector, app.configs.card.cardPhoneNumber, {delay: 150});
    await delay(1000);
    await this.page.screenshot({path: 'before-submit-phone-number.png'});
    await this.page.click(submitBtnSelector);

    await this.sendLogs(`${app.configs.crawler.name}: Жду смс код`);
    await delay(1500);
    await this.page.screenshot({path: 'after-submit-phone.png'});
    let smsCode = await this.awaitForOtp();
    await delay(2500);
    await this.page.screenshot({path: 'write-sms-code.png'});
    await this.writeSmsCode(smsCode, app.configs.card.cardPassword);
  }

  async navigateToOperationsPage() {
    let page

    await this.page.screenshot({path: 'before-Navigate-operations-page.png'});

    await delay(3000);
    await this.page.goto(process.env.TINK_OPERATIONS_URL, {
      waitUntil: "domcontentloaded"
    });

    try {
      await this.page.waitForSelector(`[id^="Tabs_"]`);
      await delay(1500);
      await this.page.screenshot({path: 'check-tabs.png'});
    } catch (e) {
      console.log(e);
    }

    try {
      let incomeBtn = await this.page.$(`[id^="Tabs_"] > div > div > div:nth-child(2) > button > span`);
      await delay(2000);
      await incomeBtn.click();
    } catch (e) {
      console.log(e);
      await this.page.screenshot({path: 'error1.png'});
      await this.sendScreenshots('./error1.png', false);
      return app.restartCrawl();
    }
    await delay(2000);
    await this.page.screenshot({path: 'after-click-income-btn.png'});

  }

  async awaitForOtp() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (app.otp.currentOpt) {
          clearInterval(interval);
          return resolve(app.otp.currentOpt);
        }
      }, 1000);
    });
  }

  async clearOtp() {
    return app.otp.removeCurrent()
  }

  async writeSmsCode(code, password) {
    let submitBtnSelector = `[type="submit"]`;
    let smsCodeInputSelector = `[name="otp"]`;
    let passwordInputSelector = `[name="password"]`;
    let smsCodeInput = await this.page.$(smsCodeInputSelector);
    await smsCodeInput.type(code.toString());
    await delay(3000)
    await this.page.screenshot({path: 'after-write-sms-code.png'});

    await this.sendLogs(`${app.configs.crawler.name}: Ввел смс код`);

    try {
      let cardNumberInput = await this.page.$('[name="card"]');
      await cardNumberInput.type(app.configs.card.cardNumber);
      await this.page.keyboard.press('Enter');
    } catch (e) {
      console.log(e)
    }


    try {
      let skipBtn = await this.page.$(`[automation-id="cancel-button"]`)
      await skipBtn.click()
    } catch (err) {
      console.log(err)
    }

    await delay(3000)
    await this.page.screenshot({path: 'after-skip-1.png'});

    let done = await this.page.$$('[href^="/events/account/Current/"]');

    if (done.length >= 1) {
      return null
    }

    try {
      await this.sendLogs(`${app.configs.crawler.name}: Начинаю вводить пароль`);
      await this.page.waitForSelector(passwordInputSelector);
      await this.page.type(passwordInputSelector, password, {delay: 200});

      await delay(1500);
      await this.page.click(submitBtnSelector);
      await this.clearOtp();
      await delay(3000);
      await this.page.screenshot({path: 'after-password.png'});
      await this.sendLogs(`${app.configs.crawler.name}: Ввел пароль`);
    } catch (e) {
      await this.page.screenshot({path: 'pass-error.png'});
      await this.sendScreenshots('./pass-error.png', false);
      await delay(40000)
      return app.restartCrawl();
    }

    try {
      let skipBtn = await this.page.$(`[automation-id="cancel-button"]`);
      await skipBtn.click();
    } catch (err) {
      console.log(err);
    }
    return true;
  }

  async startCrawling() {
    try {
      await this.login();
      await this.sendLogs(`${app.configs.crawler.name}: Иду на странцу с транзакциями`);
      app.status = true;
      await this.navigateToOperationsPage();
      await this.crawl();
      await this.sendLogs(`${app.configs.crawler.name}: Начитаю парсить`);
    } catch (err) {
      console.error(err);
      if (err?.name.includes("TimeoutError")) {

        session.closeTab();
        const crawler = await this.restartTab(
          session?.token,
          session?.getLastFilter(),
          this.headers
        );
        await this.page.screenshot({path: 'error2.png'});
        await this.sendScreenshots('./error2.png', false);

        await crawler.startCrawling();
      }
    }
  }

  async startAfterStop() {
    await this.page.goto(process.env.TINK_CREDIT_URL);
    await this.crawl();
  }

  async crawl() {
    if (this.page.isClosed()) {
      await app.restartCrawl()
      await this.page.screenshot({path: 'error3.png'});
      await this.sendScreenshots('./error3.png', false);
      return null
    } else {
      setTimeout(async () => {
        let incomeBtn = false;
        try {
          await this.page.waitForSelector(`[data-qa-file="Menu"]`);
          await this.page.screenshot({path: 'page-reload.png'});
          incomeBtn = true
        } catch (e) {
          await this.sendLogs(`${app.configs.crawler.name}: Tabs not found`);
          await this.page.screenshot({path: 'page-reload.png'})
          console.log(e)
        }

        if (incomeBtn) {
          try {
            await this.page.reload();
            await this.crawl();
          } catch (err) {
            await this.sendLogs(`${app.configs.crawler.name}: Crawl or reload error`);
            await this.page.screenshot({path: 'error8.png'});
            await this.sendScreenshots('./error8.png', false);
            console.log(err);
            await delay(process.env.TINK_CRAWLER_INTERVAL * 1000)
            await this.page.goto(process.env.TINK_CREDIT_URL);
            await this.crawl();
          }
        } else {
          await this.page.screenshot({path: 'error4.png'});
          await this.sendScreenshots('./error4.png', false);
          return app.restartCrawl();
        }

      }, parseInt(process.env.TINK_CRAWLER_INTERVAL * 1000));
    }
  }

  async saveUnprocessedRow(parsedData) {
    const ids = parsedData.map(row => row.checkuniq);
    let dataForSend = [];

    const results = await operationsService.getByIds(ids)

    const resultIds = results.map(result => result.checkuniq);
    const missingOrderIds = ids.filter(id => !resultIds.includes(id));
    let now = new Date()
    const missingOrders = parsedData
      .filter(row => {
        if (now - 1800000 < row.operationTime && missingOrderIds.includes(row.checkuniq)) {
          return true
        }
        return false
      });

    if (missingOrders.length === 0) {
      carvedData = false
    }

    if (missingOrders[0]) {
      await operationsService.insertMany(missingOrders);
      for (let missingOrder of missingOrders) {
        await this.sendTlgMessage(missingOrder);
        if (missingOrder.status !== "OK") {
          await this.sendLogs(`${app.configs.crawler.name}: Транзакция не прошла!!!!!!!!
          ${missingOrder.accountValue} RUB, ${missingOrder.status}, ${missingOrder.operationTime}
          `);
        }
      }
      return missingOrders[0];
    } else {
      return null
    }
  }

  async sendTlgMessage(operation) {
    let now = new Date()
    if (!operation || operation.isSend === true) {
      return;
    }
    let sourceData = {
      amount_rub: operation.accountValue,
      date: operation.operationTime,
      card: operation.cardNumber,
      bank: operation.bank,
      id: operation.checkuniq,
      status: operation.status
    };

    if (operation.status === 'OK') {
      await this.sendLogs(`${app.configs.crawler.name}: ======================STATUS FAIL=================== ${JSON.stringify(sourceData)}`);
      return;
    }



    const data = new FormData();
    if (operation.operationType === 'Debit') {
      data.append('amount_rub', '-' + JSON.stringify(sourceData.amount_rub));
    } else {
      data.append('amount_rub', JSON.stringify(sourceData.amount_rub));
    }

    data.append('date', JSON.stringify(sourceData.date));
    data.append('card', JSON.stringify(sourceData.card));
    data.append('bank', sourceData.bank);
    data.append('id', sourceData.id);

    let config = {
      method: 'post',
      url: app.configs.settings.transactionsSendLink,
      headers: {
        ...data.getHeaders()
      },
      data: data
    };

    await axios(config)
      .then(async function (response) {
        await operationsService.isSendStatus(sourceData.id, true);
      })
      .catch(async (err) => {
        console.log(err)
        if (resendCount > 2) {
          resendCount = 0
          await this.sendLogs(`${app.configs.crawler.name}: Не могу отправить в API ====> ${JSON.stringify(sourceData)}`);
          return null
        } else {
          resendCount += 1
          await delay(1500);
          try {
            await this.retrySendTlgMessage(operation);
          } catch (e) {
            console.log(e)
          }
          return null;
        }

      });

    return null;
  }

  async retrySendTlgMessage(operations) {
    return this.sendTlgMessage(operations)
  }

  async stop() {
    const sessionId = Object.keys(app.sessions)[0];
    const session = app.sessions[sessionId];
    await session.tab.close();
  }

  async sendScreenshots(screenshotName, tlgUserid) {
    const controller = new AbortController();
    let formdata = new FormData();
    let readStream = fs.createReadStream(screenshotName);
    formdata.append("document", readStream);

    let requestOptions = {
      method: 'POST',
      body: formdata,
      signal: controller.signal
    };

    try {
      if (tlgUserid) {
        await fetch(`https://api.telegram.org/bot${process.env.tlgApiExchangeBot}/sendDocument?chat_id=${tlgUserid}`, requestOptions)
          .then(response => response.text())
        controller.abort();
      } else {
        await fetch(`https://api.telegram.org/bot${process.env.tlgApi}/sendDocument?chat_id=${process.env.chatId}`, requestOptions)
          .then(response => response.text())
          .then(result => console.log(result))
        controller.abort()
      }
      return true
    } catch (e) {
      console.log(e)
      return false
    }

  }
}