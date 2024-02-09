const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const Browser = require("./Browser");
const { MongoClient } = require("mongodb");
const Opt = require("./Otp");
const app = require("../main");
const dashService = require('../services/dashService')

class App {
  constructor(name, options) {
    this.name = name;
    this.options = options;

    this.configure();

    this._app = express();
    this._app.use(bodyParser.json());
    this._app.use(cookieParser());
    this._app.use(express.static(process.env.STATIC_DIR_PATH));
    this._app.use(expressLayouts);

    this._app.set("layout", process.env.DEFAULT_LAYOUT_PATH);
    this._app.set("view engine", process.env.VIEW_ENGINE);
    this._app.set("views", process.env.VIEWS_PATH);

    this.otp = new Opt();
    this.browser = null;
    this.mongo = null;
    this.tab = null;
    this.sessions = {};
    this.sessionId = Object.keys(this.sessions)[0];
  }


  configure() {
    require("dotenv").config({
      path: this.options.DOT_ENV_PATH
    });

    process.env = {
      ...process.env,
      ...this.options
    };
  }

  async initMongo() {
    const client = new MongoClient(process.env.MONGO_DB_CONNECTION_STRING, {
      useNewUrlParser: true
    });
    this.mongo = (await client.connect()).db(process.env.MONGO_DB_NAME);
    this.mongo.ObjectId = require("mongodb").ObjectId;

  }

  async initPortListeners() {
    this._app.listen(
      parseInt(process.env.APPLICATION_PORT, 10),
      "0.0.0.0",
      () => {
        console.log(`listening on port ${process.env.APPLICATION_PORT}`);
      }
    );
  }

  async startparse() {
    if (!this.browser) {
      await this.initBrowser();
    }
    this.tab = await this.browser.initCrawler(this.sessionId, {}, {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
    });
    await this.tab.startAfterStop();
  }

  async initBrowser() {
    this.browser = new Browser({
      sessions: this.sessions,
    });

    await this.browser.init();
  }

  async start() {
    if (!this.browser) {
      await this.initBrowser(this.sessions);
    }
      this.tab = await this.browser.initCrawler(this.sessionId, {}, {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
      });
      this.tabOut = await this.browser.initOut(this.sessionId, {}, {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
      });

    await this.tab.startCrawling();
    await this.tabOut.startCrawling();
  }
  async startOut(){

  }



  async run() {
    try {
      await this.initMongo();
      await this.initBrowser(this.sessions);
      await this.initPortListeners();
      app.configs = await dashService.getInfo();
      app.status = false;
    } catch (err) {
      console.error(err);
    }

    return this;
  }

  async stop(){
    return this.browser.restartTab();
  }
  async restartCrawl() {
    await this.browser.restartTab();

    await this.start()

    return;
  }

}

module.exports = App;
