const { Router } = require("express");

module.exports = () => {
  const router = new Router();

  router.use("/auth", require("./auth")(Router));
  router.use("/dashboard", require("./dashboard")(Router));
  router.use("/settings", require("./settings")(Router));

  router.get("*", (req, res) => {
    res.status(404)
  });

  router.use((err, req, res, next) => {
    if (err) {
      res.render("500", {
        title: "Error",
        layout: "simple-layout"
      });
    }
  });

  return router;
};
