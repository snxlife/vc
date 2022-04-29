"use strict";

const fs = require("fs");
const express = require("express");
const md5 = require("md5");
const app = express();

const port = 8080;

app.use("/static", express.static("./public/static/"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all('*', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get("/account/:id", (req, res) => {
  fs.stat(`./public/account/${req.params.id}`, (err, stat) => {
    if (err) res.status(404).send("Not Found");
    else fs.readFile(`./public/account/${req.params.id}/config.json`, (err, data) => {
      res.send(data.toString());
    });
  });
});


/**
 * @require a json requires all datas to change
 */
app.post("/account/:id", (req, res) => {
  fs.stat(`./public/account/${req.params.id}`, (err, stat) => {
    if (err) res.status(404).send("Not Found");
    else fs.readFile(`./public/account/${req.params.id}/config.json`, (err, data) => {
      if (err) res.status(500).send("Failed to read user/config");
      let config = JSON.parse(data.toString());
      for (const k in req.body.value) {
        if (k === "user_email") continue;
        config[k]=req.body.value[k]
      }
      fs.writeFile(`./public/account/${req.params.id}/config.json`, JSON.stringify(config), err => {
        if (err) res.status(500).send("Failed to write user/config");
        else res.sendStatus(200);
      })
    });
  });
});


/**
 * @require email & ?name & pwd
 * B
 */
app.post("/create/account", (req, res) => {
  fs.readFile(`./public/account/account.json`, (err, data) => {
    let acc = JSON.parse(data.toString());
    let user_id = ++acc.count;
    if (acc.account_email[req.body.email]) {
      res.status(500).send("Account Already Created");
      return;
    } 
    acc.account_email[req.body.email] = user_id;
    fs.writeFile(`./public/account/account.json`, JSON.stringify(acc), err => {
      if (err) res.status(500).send("Failed to write account json");
    });
    fs.mkdir(`./public/account/${user_id}`, err => {
      if (err) res.status(500).send("Failed to create user folder");
      let salt = Math.ceil(100000000 * Math.random());
      fs.writeFile(`./public/account/${user_id}/config.json`, JSON.stringify({
        user_id: user_id,
        user_name: req.body.name || `Uid${user_id}`, 
        user_avatar: "https://pic4.zhimg.com/50/v2-6afa72220d29f045c15217aa6b275808_hd.jpg?source=1940ef5c", 
        user_pwd: {
          md5: md5("" + req.body.pwd + salt), salt
        },
        user_email: req.body.email, 
        user_readme: "",
        articles: []
      }), err => {
        if (err) res.status(500).send("Failed to write user/config");
        else res.sendStatus(200);
      });
    });
  });
});

app.get("/article/:id", (req, res) => {
  fs.stat(`./public/article/${req.params.id}`, (err, stat) => {
    if (err) res.status(404).send("Not Found");
    else fs.readFile(`./public/article/${req.params.id}/config.json`, (err, data) => {
      res.send(data.toString());
    });
  });
});

app.get("/article/:id/md", (req, res) => {
  fs.stat(`./public/article/${req.params.id}`, (err, stat) => {
    if (err) res.status(404).send("Not Found");
    else fs.readFile(`./public/article/${req.params.id}/.md`, (err, data) => {
      res.send(data.toString());
    });
  });
});

app.get("/article", (req, res) => {
  fs.readFile(`./public/article/article.json`, (err, data) => {
    res.send(data.toString());
  });
});


/**
 * @require title & auth & info & md
 */
app.post("/create/article", (req, res) => {
  fs.readFile(`./public/article/article.json`, (err, data) => {
    let art = JSON.parse(data.toString());
    let article_id = ++art.count;
    fs.writeFile(`./public/article/article.json`, JSON.stringify(art), err => {
      if (err) res.status(500).send("Failed to write account json");
    });
    fs.mkdir(`./public/article/${article_id}`, err => {
      if (err) res.status(500).send("Failed to create article folder");
      fs.writeFile(`./public/article/${article_id}/config.json`, JSON.stringify({
        id: article_id, 
        auth: req.body.auth,
        title: req.body.title,
        info: req.body.info,
        created: (new Date()).toISOString(),
        last_edited: (new Date()).toISOString()
      }), err => {
        if (err) res.status(500).send("Failed to write article/config");
        else fs.writeFile(`./public/article/${article_id}/.md`, req.body.md, err => {
          if (err) res.status(500).send("Failed to write article/md");
          else res.status(200).send("" + article_id);
        });
      });
    });
  });
});


/**
 * @require no require
 */
app.post("/article/:id/delete", (req, res) => {
  fs.stat(`./public/article/${req.params.id}`, (err, stat) => {
    if (err) res.status(404).send("Not Found");
    else fs.rmdir(`./public/article/${req.params.id}`, 
      { recursive: true, force: true }, err => {
        if (err) res.status(500).send("Failed to delete article");
        else res.sendStatus(200);
      });
  });
});

/**
 * @require email | id & pwd
 */
app.post("/login", (req, res) => {
  let user_id;
  if (req.body.email) {
    console.log("email");
    fs.readFile(`./public/account/account.json`, (err, data) => {
      if (err) {
        res.status(404).send("Not Found");
        return;
      }
      let acc = JSON.parse(data.toString());
      user_id = acc.account_email[req.body.email];
      if (!user_id) {
        res.status(404).send("Not Found");
        return;
      }
      fs.readFile(`./public/account/${user_id}/config.json`, (err, data) => {
        if (err) res.status(404).send("Not Found");
        let config = JSON.parse(data.toString());
        let salt = config.user_pwd.salt;
        let pwd = config.user_pwd.md5;
        if (md5("" + req.body.pwd + salt) === pwd) {
          res.status(200).send({ code: 200, user_id, config });
        } else {
          res.status(203).send({ code: 203,  msg: "Password Not Match" })
        }
      });
    });
  } else {
    user_id = req.body.id;
    fs.readFile(`./public/account/${user_id}/config.json`, (err, data) => {
      if (err) res.status(404).send("Not Found");
      let config = JSON.parse(data.toString());
      let salt = config.user_pwd.salt;
      let pwd = config.user_pwd.md5;
      if (md5("" + req.body.pwd + salt) === pwd) {
        res.status(200).send({ code: 200, user_id, config });
      } else {
        res.status(203).send({ code: 203,  msg: "Password Not Match" })
      }
    });
  }
});

/**
 * @require pwd & new_pwd
 */
app.post("/account/:id/repwd", (req, res) => {
  fs.readFile(`./public/account/${req.params.id}/config.json`, (err, data) => {
    if (err) res.status(404).send("Not Found");
    let config = JSON.parse(data.toString());
    let salt = config.user_pwd.salt;
    let pwd = config.user_pwd.md5;
    if (md5("" + req.body.pwd + salt) === pwd) {
      let salt = Math.ceil(100000000 * Math.random());
      config.user_pwd = {
        md5: md5("" + req.body.new_pwd + salt), salt
      };
      fs.writeFile(`./public/account/${req.params.id}/config.json`, JSON.stringify(config), err => {
        if (err) res.status(500).send("Failed to write user/config");
        else res.status(200).send({ code: 200, config });
      });
    } else {
      res.status(203).send({ code: 203,  msg: "Password Not Match" })
    }
  });
});



app.listen(port, () => {
  console.log(`App running at https://localhost:${port}`);
});

/*
fetch("http://localhost:8080/account/create", {
  body: `{ "name": "aaa", "email": "aaa@bbb.com", "pwd": "123456" }`, 
  method: "POST", 
  headers: {
    "Content-Type": "application/json"
  }})
  .then(res=>res.text())
  .then(res=>console.log(res))
  .catch(err=>console.log(err));

fetch("http://localhost:8080/account/2", {
  body: `{ "value": {"user_name": "test_user"} }`, 
  method: "POST", 
  headers: {
    "Content-Type": "application/json"
  }})
  .then(res=>res.text())
  .then(res=>console.log(res))
  .catch(err=>console.log(err));

fetch("http://localhost:8080/article/2/delete", {
  body: `{}`, 
  method: "POST", 
  headers: {
    "Content-Type": "application/json"
  }})
  .then(res=>res.text())
  .then(res=>console.log(res))
  .catch(err=>console.log(err));

fetch("http://localhost:8080/article/create", {
  body: `{ "title": "aaa", "auth": 1, "info": "bbb", "md": "ccc" }`, 
  method: "POST", 
  headers: {
    "Content-Type": "application/json"
  }})
  .then(res=>res.text())
  .then(res=>console.log(res))
  .catch(err=>console.log(err));
*/
