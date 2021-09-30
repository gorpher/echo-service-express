// process.env['NODE_ENV'] = 'production';
const express = require("express");
const compression = require("compression");
const app = express();
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const os = require('os');
app.use(express.urlencoded({ extended: true }));
app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      try {
        req.body = JSON.parse(buf.toString());
      } catch (e) {
        req.body = buf.toString();
      }
      req.next();
    },
  })
);
const methodRouter = express.Router();
methodRouter.use(
  express.raw({
    type: "*/*",
    verify: (req, res, buf, encoding) => {
      req.body = buf.toString();
      req.next();
    },
  })
);
app.use("/", (req, res, next) => {
  next();
});

app.get("/get", (req, res) => {
  res.status(200).json({
    args: req.query,
    headers: req.headers,
    url: req.url,
    method: req.method,
  });
});
const request_data = (req, res) => {
  let json = null;
  let data = req.body;
  let params = {};
  if (typeof data == "object") {
    json = data;
    if (req.headers["content-type"] == "application/x-www-form-urlencoded") {
      params = data;
    }
  }
  return {
    args: req.query,
    form: params,
    data: data,
    headers: req.headers,
    url: req.url,
    files: {},
    json: json,
    method: req.method,
  };
};
app.all("/", (req, res) => {
  let data = request_data(req, res);
  res.json({
    os:{
      nodejs:process.version,
      arch:os.arch(),
      cpus:os.cpus(),
      home_dir:os.homedir(),
      hostname:os.hostname(),
      network_interfaces:os.networkInterfaces(),
      release:os.release(),
      tmp_dir:os.tmpdir(),
      uptime:os.uptime(),
      version:os.version(),
      userinfo:os.userInfo(),
    },
    ...data
  })
});
methodRouter.post("/post", (req, res) => res.json(request_data(req, res)));
methodRouter.delete("/delete", (req, res) => res.json(request_data(req, res)));
methodRouter.put("/put", (req, res) => res.json(request_data(req, res)));
methodRouter.patch("/patch", (req, res) => res.json(request_data(req, res)));
app.all("/status/:code", (req, res) => {
  const { code } = req.params;
  if (code < 100 || code > 511) {
    res.sendStatus(400);
    return;
  }
  res.sendStatus(code);
});
app.get("/stream/:file", (req, res) => {
  let data = JSON.stringify(request_data(req, res));
  res.write(data, () => {
    console.log("write  ok.");
  });
  res.write(data, () => {
    console.log("write  ok.");
  });
  res.write(data, () => {
    console.log("write  ok.");
  });
  res.end();
});

app.get("/digest-auth", (req, res) => {
  console.log(req.header);
});
app.get("/basic-auth", (req, res) => {
  let authorization = req.headers["authorization"];
  if (authorization == "") {
    res.json({ authenticated: false });
    return;
  }
  let split = authorization.split(" ");
  if (!split || split.length < 2 || split[0] != "Basic") {
    res.json({ authenticated: false });
    return;
  }
  let user = Buffer.from(split[1], "base64").toString();
  if (user == "") {
    res.json({ authenticated: false });
    return;
  }
  split = user.split(":");
  if (!split || split.length < 2) {
    res.json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true });
});
app.get("/oauth1", (req, res) => {
  console.log(req.header);
});
app.get("/auth/hawk", (req, res) => {
  console.log(req.header);
});
app.get("/headers", (req, res) => res.json({ headers: req.headers }));

app.get("/response-headers", (req, res) => {
  for (k in req.query) {
    res.header(k, req.query[k]);
  }
  res.send(JSON.stringify(req.query));
});
app.get("/encoding/utf8", (req, res) => {
  console.log(process.cwd(), __dirname);
  fs.readFile(path.join(process.cwd(), "UTF-8-demo.txt"), (err, buf) => {
    if (err) {
      res.sendStatus(500);
      return;
    }
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.write("<html>");
    res.write("<body><h1>Unicode Demo</h1><pre>");
    res.write(buf.toString());
    res.write("</pre></body></html>");
    res.end();
  });
});

const gzipRouter = express.Router();
gzipRouter.use(
  compression({
    filter: (req, res) => {
      if (req.url.startsWith("/gzip")) {
        return compression.filter(req, res);
      }
      return false;
    },
  })
);
gzipRouter.all("/gzip", (req, res) => {
  // FIX
  res.json({ headers: req.headers, method: req.method, gzipped: true });
});
gzipRouter.all("/deflate", (req, res) => {
  // FIX
  res.json({ headers: req.headers, method: req.method, deflated: true });
});
app.get("/ip", (req, res) => {
  res.json({
    ip:
      req.headers["x-forwarded-for"] || // 判断是否有反向代理 IP
      req.connection.remoteAddress || // 判断 connection 的远程 IP
      req.socket.remoteAddress || // 判断后端的 socket 的 IP
      req.connection.socket.remoteAddress,
  });
});
function validateDelay(req, res, next) {
  const { delay } = req.params;
  const delayInt = parseInt(delay);

  if (isNaN(delay)) {
    res.status(400).json({ success: false, message: "Delay is not a number" });

    return;
  }

  if (delayInt < 0 || delayInt > 5000) {
    res
      .status(400)
      .json({ success: false, message: "Delay Should be between 0 and 5000" });

    return;
  }

  next();
}

app.get("/time/now", (req, res) => {
  res.json(new Date().toGMTString());
});
app.get("/time/valid", (req, res) => {
  let timestamp = req.query["timestamp"];
  let date;
  if (timestamp) {
    date = new Date(timestamp);
  }
  if (date && date != "Invalid Date") {
    res.json({ valid: true, date: date });
    return;
  }
  return res.json({ valid: false });
});

// 对Date的扩展，将 Date 转化为指定格式的String
// 月(M)、日(d)、小时(H)、分(m)、秒(s)、季度(q) 可以用 1-2 个占位符，
// 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字)
// 例子：
// (new Date()).Format("yyyy-MM-dd HH:mm:ss.S") ==> 2006-07-02 08:09:04.423
// (new Date()).Format("yyyy-M-d H:m:s.S")      ==> 2006-7-2 8:9:4.18
Date.prototype.Format = function (fmt) {
  var o = {
    "M+": this.getMonth() + 1,
    "d+": this.getDate(),
    "H+": this.getHours(),
    "m+": this.getMinutes(),
    "s+": this.getSeconds(),
    "S+": this.getMilliseconds(),
  };
  //因为date.getFullYear()出来的结果是number类型的,所以为了让结果变成字符串型，下面有两种方法：
  if (/(y+)/.test(fmt)) {
    //第一种：利用字符串连接符“+”给date.getFullYear()+''，加一个空字符串便可以将number类型转换成字符串。
    fmt = fmt.replace(
      RegExp.$1,
      (this.getFullYear() + "").substr(4 - RegExp.$1.length)
    );
  }
  for (var k in o) {
    if (new RegExp("(" + k + ")").test(fmt)) {
      //第二种：使用String()类型进行强制数据类型转换String(date.getFullYear())，这种更容易理解。
      fmt = fmt.replace(
        RegExp.$1,
        RegExp.$1.length == 1 ? o[k] : ("00" + o[k]).substr(String(o[k]).length)
      );
    }
  }
  return fmt;
};

app.get("/time/format", (req, res) => {
  let timestamp = req.query["timestamp"];
  let fortmat = req.query["format"];
  if (timestamp && fortmat) {
    res.json({ format: new Date(timestamp).Format(fortmat) });
    return;
  }
  return res.json({ format: "" });
});
app.get("/time/unit", (req, res) => {
  let timestamp = req.query["timestamp"];
  let unit = req.query["unit"];
  if (timestamp && unit) {
    if (unit.toLocaleString() === "day") {
      res.json({ unit: new Date(timestamp).getDay() });
      return;
    }
    if (unit.toLocaleString() === "date") {
      res.json({ unit: new Date(timestamp).getDate() });
      return;
    }
    if (unit.toLocaleString() === "month") {
      res.json({ unit: new Date(timestamp).getMonth() });
      return;
    }
    if (unit.toLocaleString() === "year") {
      res.json({ unit: new Date(timestamp).getFullYear() });
      return;
    }
    if (unit.toLocaleString() === "hours") {
      res.json({ unit: new Date(timestamp).getHours() });
      return;
    }
    if (unit.toLocaleString() === "minutes") {
      res.json({ unit: new Date(timestamp).getMinutes() });
      return;
    }
    if (unit.toLocaleString() === "seconds") {
      res.json({ unit: new Date(timestamp).getSeconds() });
      return;
    }
    if (unit.toLocaleString() === "milliseconds") {
      res.json({ unit: new Date(timestamp).getMilliseconds() });
      return;
    }
  }
  res.json({ unit: 0 });
});

app.get("/delay/:delay", validateDelay, (req, res) => {
  let { delay } = req.params;
  setTimeout(() => {
    res.json({ delay: delay });
  }, delay);
});

const cookieRouter = express.Router();
const jsonParser = express.json();
const cookieParser = require("cookie-parser");
const { time } = require("console");
cookieRouter.use(jsonParser);
cookieRouter.use(cookieParser());
cookieRouter.get("/cookies/", (req, res) => {
  res.json(req.cookies);
});


cookieRouter.get("/cookies/set", (req, res) => {
  for (const k in req.query) {
    const stringValue = req.query[k].toString();
    // Set Cookie
    try {
      res.cookie(k, stringValue);
    } catch (TypeError) {
      res.status(400).json({ success: false, message: "Invalid Cookie" });
      return;
    }
  }
  res.json({ cookies: req.query });
});
cookieRouter.get("/cookies/delete", (req, res) => {
  // remove cookie
  try {
    for (const k in req.query) {
      res.clearCookie(k);
      req.cookies[k] = undefined;
    }
  } catch (TypeError) {
    res.status(400).json({ success: false, message: "Invalid Cookie" });
    return;
  }

  res.json({ cookies: req.cookies });
});

const port = 8080;

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
