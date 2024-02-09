const Tab = require("./Tab");
const TabOut = require('./TabOut');

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");


puppeteer.use(require("puppeteer-extra-plugin-angular")());
puppeteer.use(StealthPlugin());
puppeteer.use(require('puppeteer-extra-plugin-user-preferences')({
  userPrefs: {
    download: {
      prompt_for_download: false,
      open_pdf_in_system_reader: true
    },
    plugins: {
      always_open_pdf_externally: true // this should do the trick
    }
  }
}))

module.exports = class Browser {
  constructor({sessions}) {
    this.sessions = sessions;
    this.window;
  }

  async pages() {
    return this.window.pages()
  }

  async init() {
    if (process.env.NODE_ENV !== "production") {
      this.window = await puppeteer.launch({
        defaultViewport: {width: 1920, height: 1080},
        headless: true,
        args: ["--no-sandbox", '--allow-file-access-from-files', '--enable-local-file-accesses'],
        // executablePath: '/usr/bin/chromium-browser'
      });
    } else {
      this.window = await puppeteer.launch({
        defaultViewport: {width: 1920, height: 1080},
        headless: true,
        args: ["--no-sandbox"],
        // executablePath: "/usr/bin/chromium-browser"
      });
    }

    this.window.on('targetcreated', async (target) => {

      if (target.type() !== 'page') {
        return;
      }
      try {
        const pageList = await this.window.pages();
        pageList.forEach((page) => {

          page.target().createCDPSession()
            .then(client => {
              client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: './checks/',
              });
            })
        });
      } catch (e) {
        console.log("targetcreated", e);
      }
    });


    this.window.once("disconnected", () => {
      this.window = null;
      console.error(
        "[Browser has closed or crashed and we've been disconnected!] \n"
      );
    });
  }

  async restartTab() {
    await this.window.close()
    this.window = await puppeteer.launch({
      defaultViewport: {width: 1920, height: 1080},
      headless: true,
      args: ["--no-sandbox"],
      // executablePath: '/usr/bin/chromium-browser'
    });
    return
  }

  async killTab(sessionToken) {
    await this.sessions[sessionToken]?.closeTab();
  }

  async initCrawler(sessionToken, filter, headers) {
    if (this.sessions[sessionToken]?.tab) {
      return;
    }

    const page = await this.window.newPage();


    const tab = new Tab(
      page,
      this.sessions[sessionToken],
      headers,
      this.initCrawler.bind(this)
    );
    await tab.prepare();

    this.sessions[sessionToken]?.setLastFilter(filter);
    this.sessions[sessionToken]?.setTab(tab);

    return tab;
  }

  async initOut(sessionToken, filter, headers) {
    if (this.sessions[sessionToken]?.tab) {
      return;
    }

    const pageOut = await this.window.newPage();


    const tabOut = new TabOut(
      pageOut,
      this.sessions[sessionToken],
      headers,
      this.initCrawler.bind(this)
    );
    await tabOut.prepare();

    this.sessions[sessionToken]?.setLastFilter(filter);
    this.sessions[sessionToken]?.setTab(tabOut);

    return tabOut;
  }

  async saveResultsAndNotify(filteredRowsData, sessionToken) {
  }
};
