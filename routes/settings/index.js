const authMiddleware = require("../../middlewares/auth");

const helperService = require('../../services/helperService');

module.exports = Router => {
  const router = new Router({ mergeParams: true });

  router.get("/", authMiddleware, (req, res) => {
    res.render("cardedit", {
      title: "Change card",
      fistName: req.user.first_name,
      lastName: req.user.last_name,
      role: req.user.role
    });
  });
  router.get("/liveData", authMiddleware, async (req, res) => {
    let liveData = await helperService.getLiveData();
    res.send(liveData);
  });
  router.post("/changecart", authMiddleware, async (req, res) => {
    let cartExists = helperService.cardCount()
    let reqData = req.body;
    if (cartExists) {
      await helperService.replaceCard(reqData)
    } else {
      await helperService.insertCard(reqData)
    }
    res.end(
      JSON.stringify({
        status: "success"
      })
    );
  });

  router.post("/tlgLinkEdit", async (req, res) => {
    let tlgLinkEdit = await helperService.tlgDataCount();
    let reqData = req.body;
    if (tlgLinkEdit === 1) {
      await helperService.replaceTlgData(reqData);
    } else {
      await helperService.insertTlgData(reqData)
    }
    res.end(
      JSON.stringify({
        status: "success"
      })
    );
  });

  router.post("/changecc", async (req, res) => {
    let ccExists = await helperService.carvedCount()
    let reqData = req.body;
    if (ccExists === 1) {
      await helperService.replaceCarvedCount(reqData)
    } else {
      await helperService.insertCarvedCount(reqData)
    }
    res.end(
      JSON.stringify({
        status: "success"
      })
    );
  });

  router.get("/changecart", authMiddleware, async (req, res) => {
    let cartData = await helperService.findCard()
    if (cartData) {
      res.end(
        JSON.stringify({
          ...cartData
        })
      );
    } else {
      JSON.stringify({
        cartStatus: "Is not define"
      });
    }
  });


  return router;
};
