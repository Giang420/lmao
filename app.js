// var createError = require('http-errors');
// var express = require('express');
// var path = require('path');
// var cookieParser = require('cookie-parser');
// var logger = require('morgan');
//
// var indexRouter = require('./routes/index');
// var usersRouter = require('./routes/users');
//
// var app = express();
//
// // // view engine setup
// // app.set('views', path.join(__dirname, 'views'));
// // app.set('view engine', 'pug');
// //
// // app.use(logger('dev'));
// // app.use(express.json());
// // app.use(express.urlencoded({ extended: false }));
// // app.use(cookieParser());
// // app.use(express.static(path.join(__dirname, 'public')));
// //
// // app.use('/', indexRouter);
// // app.use('/users', usersRouter);
// //
// // // catch 404 and forward to error handler
// // app.use(function(req, res, next) {
// //   next(createError(404));
// // });
// //
// // // error handler
// // app.use(function(err, req, res, next) {
// //   // set locals, only providing error in development
// //   res.locals.message = err.message;
// //   res.locals.error = req.app.get('env') === 'development' ? err : {};
// //
// //   // render the error page
// //   res.status(err.status || 500);
// //   res.render('error');
// // });
// //
//
// // view engine setup
// app.set('views', path.join(__dirname, '/'));
// app.set('view engine', 'ejs');
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({
//   extended: false
// }));

// app.post('/datahaha', function(req, res) {
//   conn.query('SELECT * FROM sthsthsth WHERE MOB  = "' + req.body.MOB + '"',
//       function(err, rows, fields) {
//         if (err) {
//           res.json({
//             msg: 'error'
//           });
//         } else {
//           res.json({
//             msg: 'success',
//             data: rows
//           });
//         }
//       });
// });
// app.post('/datahaha', function(req, res) {
//   conn.query('SELECT * FROM cities WHERE city_id = "' + req.body.state_id + '"',
//       function(err, rows, fields) {
//         if (err) {
//           res.json({
//             msg: 'error'
//           });
//         } else {
//           res.json({
//             msg: 'success',
//             cities: rows
//           });
//         }
//       });
// });
// // port must be set to 8080 because incoming http requests are routed from port 80 to port 8080
// app.listen(3000, function() {
//   console.log('Node app is running on port 3000');
// });
// module.exports = app;
// var createError = require('http-errors');
// var http = require('http');
// // var express = require('express');
// var path = require('path');
// var bodyParser = require('body-parser');
// // var app = express();
// var mysql = require('mysql');
/**
 * NodeJs Server-Side Example for Fine Uploader (traditional endpoints).
 * Maintained by Widen Enterprises.
 *
 * This example:
 *  - handles non-CORS environments
 *  - handles delete file requests assuming the method is DELETE
 *  - Ensures the file size does not exceed the max
 *  - Handles chunked upload requests
 *
 * Requirements:
 *  - express (for handling requests)
 *  - rimraf (for "rm -rf" support)
 *  - multiparty (for parsing request payloads)
 *  - mkdirp (for "mkdir -p" support)
 */

// Dependencies
var express = require("express"),
    fs = require("fs"),
    rimraf = require("rimraf"),
    mkdirp = require("mkdirp"),
    multiparty = require('multiparty'),
    app = express(),

    // paths/constants
    fileInputName = process.env.FILE_INPUT_NAME || "qqfile",
    publicDir = process.env.PUBLIC_DIR,
    nodeModulesDir = process.env.NODE_MODULES_DIR,
    uploadedFilesPath = process.env.UPLOADED_FILES_DIR,
    chunkDirName = "chunks",
    port = process.env.SERVER_PORT || 3000,
    maxFileSize = process.env.MAX_FILE_SIZE || 0;
const {response} = require("express"); // in bytes, 0 for unlimited




// routes
// app.use(express.static(publicDir));
// app.use("/node_modules", express.static(nodeModulesDir));
app.post("/uploads", onUpload);
app.delete("/uploads/:uuid", onDeleteFile);


function onUpload(req, res) {
  var form = new multiparty.Form();

  form.parse(req, function(err, fields, files) {
    var partIndex = fields.qqpartindex;

    // text/plain is required to ensure support for IE9 and older
    res.set("Content-Type", "text/plain");

    if (partIndex == null) {
      onSimpleUpload(fields, files[fileInputName][0], res);
    }
    else {
      onChunkedUpload(fields, files[fileInputName][0], res);
    }
  });
}

function onSimpleUpload(fields, file, res) {
  var uuid = fields.qquuid,
      responseData = {
        success: false
      };

  file.name = fields.qqfilename;

  if (isValid(file.size)) {
    moveUploadedFile(file, uuid, function() {
          responseData.success = true;
          res.send(responseData);
        },
        function() {
          responseData.error = "Problem copying the file!";
          res.send(responseData);
        });
  }
  else {
    failWithTooBigFile(responseData, res);
  }
}

function onChunkedUpload(fields, file, res) {
  var size = parseInt(fields.qqtotalfilesize),
      uuid = fields.qquuid,
      index = fields.qqpartindex,
      totalParts = parseInt(fields.qqtotalparts),
      responseData = {
        success: false
      };

  file.name = fields.qqfilename;

  if (isValid(size)) {
    storeChunk(file, uuid, index, totalParts, function() {
          if (index < totalParts - 1) {
            responseData.success = true;
            res.send(responseData);
          }
          else {
            combineChunks(file, uuid, function() {
                  responseData.success = true;
                  res.send(responseData);
                },
                function() {
                  responseData.error = "Problem conbining the chunks!";
                  res.send(responseData);
                });
          }
        },
        function(reset) {
          responseData.error = "Problem storing the chunk!";
          res.send(responseData);
        });
  }
  else {
    failWithTooBigFile(responseData, res);
  }
}

function failWithTooBigFile(responseData, res) {
  responseData.error = "Too big!";
  responseData.preventRetry = true;
  res.send(responseData);
}

function onDeleteFile(req, res) {
  var uuid = req.params.uuid,
      dirToDelete = uploadedFilesPath + uuid;

  rimraf(dirToDelete, function(error) {
    if (error) {
      console.error("Problem deleting file! " + error);
      res.status(500);
    }

    res.send();
  });
}

function isValid(size) {
  return maxFileSize === 0 || size < maxFileSize;
}

function moveFile(destinationDir, sourceFile, destinationFile, success, failure) {
  mkdirp(destinationDir, function(error) {
    var sourceStream, destStream;

    if (error) {
      console.error("Problem creating directory " + destinationDir + ": " + error);
      failure();
    }
    else {
      sourceStream = fs.createReadStream(sourceFile);
      destStream = fs.createWriteStream(destinationFile);

      sourceStream
          .on("error", function(error) {
            console.error("Problem copying file: " + error.stack);
            destStream.end();
            failure();
          })
          .on("end", function(){
            destStream.end();
            success();
          })
          .pipe(destStream);
    }
  });
}

function moveUploadedFile(file, uuid, success, failure) {
  var destinationDir = uploadedFilesPath + uuid + "/",
      fileDestination = destinationDir + file.name;

  moveFile(destinationDir, file.path, fileDestination, success, failure);
}

function storeChunk(file, uuid, index, numChunks, success, failure) {
  var destinationDir = uploadedFilesPath + uuid + "/" + chunkDirName + "/",
      chunkFilename = getChunkFilename(index, numChunks),
      fileDestination = destinationDir + chunkFilename;

  moveFile(destinationDir, file.path, fileDestination, success, failure);
}

function combineChunks(file, uuid, success, failure) {
  var chunksDir = uploadedFilesPath + uuid + "/" + chunkDirName + "/",
      destinationDir = uploadedFilesPath + uuid + "/",
      fileDestination = destinationDir + file.name;


  fs.readdir(chunksDir, function(err, fileNames) {
    var destFileStream;

    if (err) {
      console.error("Problem listing chunks! " + err);
      failure();
    }
    else {
      fileNames.sort();
      destFileStream = fs.createWriteStream(fileDestination, {flags: "a"});

      appendToStream(destFileStream, chunksDir, fileNames, 0, function() {
            rimraf(chunksDir, function(rimrafError) {
              if (rimrafError) {
                console.log("Problem deleting chunks dir! " + rimrafError);
              }
            });
            success();
          },
          failure);
    }
  });
}

function appendToStream(destStream, srcDir, srcFilesnames, index, success, failure) {
  if (index < srcFilesnames.length) {
    fs.createReadStream(srcDir + srcFilesnames[index])
        .on("end", function() {
          appendToStream(destStream, srcDir, srcFilesnames, index + 1, success, failure);
        })
        .on("error", function(error) {
          console.error("Problem appending chunk! " + error);
          destStream.end();
          failure();
        })
        .pipe(destStream, {end: false});
  }
  else {
    destStream.end();
    success();
  }
}

function getChunkFilename(index, count) {
  var digits = new String(count).length,
      zeros = new Array(digits + 1).join("0");

  return (zeros + index).slice(-digits);
}


app.listen(port);

























































































































































































































































