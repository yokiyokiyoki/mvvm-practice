// 该版本修复<div>{{a}}{{b}}</div>,匹配不到后面的{{b}}的问题
// 该版本实现了计算属性的get，mounted钩子，数据劫持，数据代理，模板编译{{}},v-model双向绑定

//创建一个mvvm构造函数
//options默认赋值==options||{{}}
function Mvvm(options = {}) {
  //vm.$options Vue将所有属性挂载到上面
  //我们也将所有属性挂到$options
  this.$options = options;
  //this._data和vue一样
  let data = (this._data = this.$options.data);

  //数据劫持
  observe(data);

  //数据代理
  //this代理了this._data
  for (let key in data) {
    Object.defineProperty(this, key, {
      configurable: false,
      get() {
        return this._data[key];
      },
      set(newVal) {
        this._data[key] = newVal;
      }
    });
  }

  //初始化computed,将this指向实例
  options.computed && initComputed.call(this);
  //数据编译
  this.$compile = new Compile(this.$options.el || document.body, this);
  //所有事情处理好后执行mounted钩子函数
  options.mounted && options.mounted.call(this);
}

//创建一个Observe构造函数
//写数据劫持的主要逻辑
function Observe(data) {
  //构造一个事件池
  let dep = new Dep();
  //所谓数据劫持就是给对象增加get和set
  //先遍历一遍对象再说
  for (let key in data) {
    let val = data[key];
    observe(val); //递归向下查找，实现深度的数据劫持
    Object.defineProperty(data, key, {
      configurable: true,
      get() {
        console.log("getter");
        Dep.target && dep.addSub(Dep.target); //将watcher添加到订阅事件种[watcher]
        return val;
      },
      set(newVal) {
        console.log("setter");
        //更改值的时候
        if (val === newVal) {
          //新旧一样就不管
          return;
        }
        val = newVal;
        observe(newVal); //当设置为新值后，也需要把新值再去定义成属性，也进行数据劫持（这里专门针对对象而言）
        dep.notify(); //让所有的wtacher的update方法执行就行
        console.log(dep);
      }
    });
  }
}
//外面再写个函数
//不用每次调用都写个new
//方便递归调用
function observe(data) {
  //如果不是对象就return
  //防止递归溢出
  if (!data || typeof data != "object") return;
  return new Observe(data);
}
//Compile构造函数
function Compile(el, vm) {
  //将el挂载到实例上，方便调用
  vm.$el = document.querySelector(el);
  //在el范围内，把所有内容都拿到，当然不能一个个拿
  //可以选择移到内存中去然后放入文档碎片中，节省开销
  let fragment = document.createDocumentFragment();
  while ((child = vm.$el.firstChild)) {
    // 此时将el中的内容放入内存中
    fragment.appendChild(child);
  }
  //对el的内容进行替换
  function replace(frag) {
    //先把dom节点变成数组
    Array.from(frag.childNodes).forEach(node => {
      let txt = node.textContent;
      let reg = /\{\{(.*?)\}\}/g; //全局正则匹配{{}}
      if (node.nodeType === 3 && reg.test(txt)) {
        function replaceTxt() {
          node.textContent = txt.replace(reg, (matched, placeholder) => {
            //如果是{{}}，里面是空的，直接返回
            if (placeholder == "") return;
            console.log(placeholder); //匹配到的分组，class.name,name
            new Watcher(vm, placeholder, replaceTxt); //监听变化，匹配替换内容
            return placeholder.split(".").reduce((val, key) => {
              return val[key];
            }, vm);
          });
        }
        //进行替换
        replaceTxt();
      }
      if (node.nodeType === 1) {
        //如果是元素节点
        let nodeAttr = node.attributes; //获取dom上所有属性，是个类数组
        Array.from(nodeAttr).forEach(attr => {
          let name = attr.name; //v-model type
          let exp = attr.value; //text
          if (name.includes("v-")) {
            node.value = vm[exp]; //this.c=2,给节点赋值
          }
          //监听变化
          new Watch(vm, exp, newVal => {
            node.value = newVal; // 当watcher触发时会自动将内容放入输入框中
          });
          node.addEventListener("input", e => {
            let newVal = e.target.value;
            //相当于给this.c一个新值
            //而值的改变会调用set，set中又会调用notify,notify中调用watcher的update方法
            vm[exp] = newVal;
          });
        });
      }
      //如果还有子节点，那么继续递归replace
      if (node.childNodes && node.childNodes.length) {
        replace(node);
      }
    });
  }
  //替换文档碎片的内容
  replace(fragment);
  //将文档碎片放入el里
  vm.$el.appendChild(fragment);
}
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
function Watcher(vm, exp, fn) {
  this.fn = fn; //将fn放在实例上
  this.vm = vm;
  this.exp = exp;
  //添加一个事件，先定义一个属性
  Dep.target = this;
  let arr = exp.split(".");
  let val = vm;
  arr.forEach(key => {
    //取值
    val = val[key]; //获取到this.a.b，默认就会调用get方法
  });
  Dep.target = null;
}
//通过watch这个类创建的实例，都有update方法
Watcher.prototype.update = function() {
  //notify的时候值已经更改了
  //再通过vm，exp来获取新的值
  let arr = this.exp.split(".");
  let val = this.vm;
  arr.forEach(key => {
    val = val[key]; //通过get获取新的值
  });
  this.fn(val);
};
//计算属性
function initComputed() {
  let vm = this;
  let computed = this.$options.computed; //从options上拿到computed属性 {sum:f,name:f}
  //先转成数组
  Object.keys(computed).forEach(key => {
    //key就是sum，name
    Object.defineProperty(vm, key, {
      //这里判断computed里的key是对象还是函数
      // 如果是函数直接调用get方法
      //如果是对象的话，手动调一下get方法即可
      //如：sum(){return this.a+this.b}，他们获取a和b的值就会调用get方法
      //所以不需要new Watcher去监听变化了
      get:
        typeof computed[key] === "function" ? computed[key] : computed[key].get,
      set() {}
    });
  });
}
