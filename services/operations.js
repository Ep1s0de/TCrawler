const {mongo} = require("../main");
const app = require("../main");

class Operations {
  constructor() {
  }

  async getByIds(ids) {
    return mongo.collection("operations")
      .find({
        checkuniq: {$in: ids}
      })
      .toArray();
  }

  async insertMany(data) {
    return mongo.collection("operations")
      .insertMany(data)
  }

  async isSendStatus(uniqId, status){
    return mongo
      .collection("operations")
      .update({
          checkuniq: uniqId
        },
        {
          $set: {isSend: status}
        })
  }

  async findAndSort(){
    return  app.mongo.collection("operations").find().sort({ operationTime: -1 }).toArray();
  }
}

module.exports = new Operations();
