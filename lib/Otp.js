module.exports = class {
  constructor() {
    this.currentOpt = null;
    this.currentWithdrawOtp = null;
  }

  setCurrent(otp) {
    this.currentOpt = otp;
  }

  removeCurrent() {
    this.currentOpt = null;
  }

  setCurrentWithdrawOtp(otp) {
    this.currentWithdrawOtp = otp;
  }

  removeCurrentWithdrawOtp() {
    this.currentWithdrawOtp = null;
  }
};