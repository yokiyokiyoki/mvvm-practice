//发布订阅模式 [fn1,fn2]
function Dep() {
  // 一个数组(存放函数的事件池)
  this.subs = [];
}
Dep.prototype = {
  addSub(sub) {
    this.subs.push(sub);
  },
  notify() {
    //绑定的方法，都有一个update方法
    this.subs.forEach(sub => sub.update());
  }
};
// 监听函数
function Watcher(fn) {
  this.fn = fn; //将fn放在实例上
}
//通过watch这个类创建的实例，都有update方法
Watcher.prototype.update = function() {
  this.fn();
};
let watcher = new Watcher(() => console.log(123));
let dep = new Dep();
dep.addSub(watcher);
dep.addSub(watcher);
dep.notify();
