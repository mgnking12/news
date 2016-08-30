//initialize express app
var express = require('express');
var app = express();

//for scraping
var request = require('request');
var cheerio = require('cheerio');
var ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.57.2 (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2'
    // var url = 'http://www.austinpetsalive.org/adopt/dogs/'


//some other fun dependencies
var logger = require('morgan');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');

//middleware to use morgan and bodyparser
app.use(logger('dev'));
app.use(bodyParser.urlencoded({
    extended: false
}));

//public static dir
app.use(express.static(process.cwd() + '/public'));
var exphbs = require('express-handlebars');
app.engine('handlebars', exphbs({
    defaultLayout: 'main'
}));
app.set('view engine', 'handlebars');

//connect to db
mongoose.connect('mongodb://heroku_6bdm103c:tgcb6tcvkr8vfrlfr1igo4quhn@ds019076.mlab.com:19076/heroku_6bdm103c');
var db = mongoose.connection;

// show any mongoose errors
db.on('error', function(err) {
    console.log('Mongoose Error: ', err);
});

// once logged in to the db through mongoose, log a success message
db.once('open', function() {
    console.log('Mongoose connection successful.');
});


// And we bring in our Note and Article models
var Note = require('./models/Note.js');
var Article = require('./models/Article.js');


// Routes
// ======

// Simple index route
app.get('/', function(req, res) {
    res.render('index');
});


app.get('/scrape', function(req, res) {
    request('http://www.austinpetsalive.org/adopt/dogs/', function(error, response, html) {
        if (error || response.statusCode != 200) {
            console.log(error);
        } else {
            var result = {};
            var $ = cheerio.load(html);

            $('li.pet').each(function(i, element) {

                result.title = $(element).find("h3").text();
                result.link = $(element).find("p").text();
                var entry = new Article(result);

                entry.save(function(err, doc) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log(doc);
                    }
                });
            });
        }
    });



    res.redirect("/");
});

// this will get the articles we scraped from the mongoDB
app.get('/articles', function(req, res) {
    // grab every doc in the Articles array
    Article.find({}, function(err, doc) {
        // log any errors
        if (err) {
            console.log(err);
        }
        // or send the doc to the browser as a json object
        else {
            res.json(doc);
        }
    });
});

// grab an article by it's ObjectId
app.get('/articles/:id', function(req, res) {
    // using the id passed in the id parameter, 
    // prepare a query that finds the matching one in our db...
    Article.findOne({ '_id': req.params.id })
        // and populate all of the notes associated with it.
        .populate('note')
        // now, execute our query
        .exec(function(err, doc) {
            // log any errors
            if (err) {
                console.log(err);
            }
            // otherwise, send the doc to the browser as a json object
            else {
                res.json(doc);
            }
        });
});


// replace the existing note of an article with a new one
// or if no note exists for an article, make the posted note it's note.
app.post('/articles/:id', function(req, res) {
    // create a new note and pass the req.body to the entry.
    var newNote = new Note(req.body);

    // and save the new note the db
    newNote.save(function(err, doc) {
        // log any errors
        if (err) {
            console.log(err);
        }
        // otherwise
        else {
            // using the Article id passed in the id parameter of our url, 
            // prepare a query that finds the matching Article in our db
            // and update it to make it's lone note the one we just saved
            Article.findOneAndUpdate({ '_id': req.params.id }, { 'note': doc._id })
                // execute the above query
                .exec(function(err, doc) {
                    // log any errors
                    if (err) {
                        console.log(err);
                    } else {
                        // or send the document to the browser
                        res.send(doc);
                    }
                });
        }
    });
});







// listen on port 3000

var PORT = process.env.PORT || 3000
app.listen(PORT, function() {
    console.log("Listening at Port " + PORT)
});