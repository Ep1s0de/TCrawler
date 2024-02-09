const app = require("../../main");
const authMiddleware = require("../../middlewares/auth");
const operationService = require('../../services/operations');
const helperService = require('../../services/helperService');

const axios = require("axios");
const pm2 = require('pm2');
app.crawlStatus = false

module.exports = Router => {
  const router = new Router({ mergeParams: true });

  router.get("/", authMiddleware, (req, res) => {
    res.render("dashboard", {
      title: "Dashboard",
      fistName: req.user.first_name,
      lastName: req.user.last_name,
      role: req.user.role,
      hasOpenTab: app.sessions[req.cookies["session_token"]]?.getTab(),
      isIdle: app.sessions[req.cookies["session_token"]]?.getIsIdle(),
      lastFilter: app.sessions[req.cookies["session_token"]]?.getLastFilter()
    });
  });

  router.get('/status', (req, res) => {
    res.send({
      crawlerStatus: app.crawlStatus
    });
  })

  router.post("/start", async (req, res) => {

    app.crawlStatus = true
    res.sendStatus(200)

    return app.start();

    res.end('OK')
  });

  router.post("/start-withdraw", async (req, res) => {

    if(app.crawlStatus === true){
      await app.startWithdraw();
      return res.send(JSON.stringify({status: true}));
    }
    else {
      return res.send(JSON.stringify({status: false}));
    }


  });
  router.post("/startafterstop", async (req, res) => {

    res.sendStatus(200)

    return app.startparse();

    res.end('OK')
  });
  router.get("/operations", async (req, res) => {
    let data = operationService.findAndSort()
    const sessionId = Object.keys(app.sessions)[0];
    const session = app.sessions[sessionId];
    await session?.emitToSockets("initialLoadData", data);
    res.end(
      JSON.stringify({ message: "Done" })
    );
  });
  
  

  router.post("/stop", async (req, res) => {
    let tlgData = await helperService.findTlgData();
    await axios.get(`https://api.telegram.org/bot${tlgData.api}/sendMessage?chat_id=${tlgData.user}&text=Stop`);
    await resApp.stop();
  });

  router.post("/sessions", authMiddleware, async (req, res) => {
    const sessionToken = req.cookies["session_token"];

    await app.sessions[sessionToken].setIsIdle(false);

    res.end(
      JSON.stringify({
        status: "success"
      })
    );
  });

  router.delete("/sessions", authMiddleware, async (req, res) => {
    const sessionToken = req.cookies["session_token"];

    await app.browser.killTab(sessionToken);

    await helperService.changeSessionStatus("rejected")

    res.end(
      JSON.stringify({
        status: "success"
      })
    );
  });

  router.patch("/sessions", authMiddleware, async (req, res) => {
    const sessionToken = req.cookies["session_token"];

    await app.sessions[sessionToken].setIsIdle(true);

    res.end(
      JSON.stringify({
        status: "success"
      })
    );
  });

  router.put("/otp", async (req, res) => {
    await app.otp.setCurrent(req.body.opt);
    return res.json({});
  });

  router.put("/wotp", async (req, res) => {
    await app.otp.setCurrentWithdrawOtp(req.body.opt);
    return res.json({});
  });

  router.post("/restart-app", async (req, res) => {

    res.json({});
    await pm2.connect(function(err) {
      if (err) {
        console.error(err);
        process.exit(2);
      }

      pm2.restart('main', function(err) {
        pm2.disconnect();
        if (err) throw err
      });
    });

  });

  return router;
};
