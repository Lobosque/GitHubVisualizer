/**
 * User: ArtZub
 * Date: 11.01.13
 * Time: 21:41
 */

'use strict';

if(typeof(window.hasOAuth) === "string") {
    ghcs.settings.access.code = window.hasOAuth;
    var code = 'code=' + window.hasOAuth;
    var rg = new RegExp('[\\?&]' + code);
    location.href = location.href.replace(location.search, location.search.replace(rg, ''));
    delete window["hasOAuth"];
}

var timeFormat = (function() {
    var fd = d3.time.format("%b %d, %Y %X");
    return function(ms) {
        return fd(new Date(ms - TIME_ZONE));
    }
})();

var textFormat = d3.format(",");

var shortTimeFormat = (function() {
    var fd = d3.time.format("%d.%b.%y");
    return function(ms) {
        return fd(new Date(ms - TIME_ZONE));
    }
})();

var log;

var cs, svg_cs, svg,
    margin = {top: 20, right: 20, bottom: 20, left: 20},
    w, h, stackLoad = 0,
    psBar, runBtn, ldrTop, toolTip, showBtn,
    visBtn, visBtnRestart, visBtnStop, visBtnPause,
    repoList,
    userTxt, curRep, divStat, stepsBar,
    cbDlr, cbDlsr, cbDlvml,
    criticalError;

function updateStatus(pos, label) {
    pos = pos > ghcs.states.max ? ghcs.states.max : pos;
    psBar.setPos((pos * 100 / (ghcs.states.max || 1)) + "%")
        .setLabel(label || "Completed " + pos + " of " + ghcs.states.max + " commits ...");
}

function rewriteHash() {
    var step,
        hash = [];
    if (this == showBtn.node() && ghcs.params) {
        step = 0;
    }
    else if (this == runBtn.node() && ghcs.params) {
        step = 1;
    }

    switch (step) {
        case 1:
            ghcs.params.repo = ghcs.repo ? ghcs.repo.name : null;
            ghcs.params.repo && hash.push("repo=" + ghcs.params.repo);
            ghcs.params.climit > 0 && hash.push("climit=" + ghcs.params.climit);
        case 0:
            ghcs.params.user && hash.push("user=" + ghcs.params.user);
            ghcs.params.rot && hash.push("rot=" + ghcs.params.rot);
            break;
    }
    document.location.hash = "#" + hash.join("&");
}

function chRadio(d) {
    switch(this.name) {
        case "participation" : {
        }
    }
}

function chCheckbox(d) {
    var ln;
    d = d3.select(this);
    switch(d.attr("id")) {
        case "cb-dlr":
        case "cb-dlsr":
            ln = d.datum();
            if (vis.layers[ln]) {
                ((d.property("checked") && vis.layers[ln].show()) || vis.layers[ln].hide());
            }
            break;
        case "cb-dllh":
            if (vis.layers.repo
                && vis.layers.repo.langHg) {
                vis.layers.repo.langHg.style("display", d.property("checked") ? null : "none");
            }
            break;
        case "cb-dlucdg":
            if (vis.layers.stat
                && vis.layers.stat.ucDg) {
                vis.layers.stat.ucDg.style("display", d.property("checked") ? null : "none");
            }
            break;
        case "cb-dlvml":
            d.property("checked") ? cs.show() : cs.hide();
            break;
        default :
            if ((ln = d.datum()) && ln.ns) {
                ln.ns[ln.key] = d.property("checked");
            }
            break;
    }
}

function chValue(d) {
    var ln;
    d = d3.select(this);
    if ((ln = d.datum()) && ln.ns){
        ln.ns[ln.key] = this.type == "number" ? +d.property("value") : d.property("value");
    }
}

function checkCompleted() {
    if (ghcs.states.cur >= ghcs.states.max) {
        psBar.setPos("100%").hide();
        if (ghcs.states.complete)
            ghcs.states.complete();
        return true;
    }
    return false;
}

function redrawStats() {
    if (ghcs.redrawStatsTimer) {
        clearTimeout(ghcs.redrawStatsTimer);
        ghcs.redrawStatsTimer = null;
    }
    ghcs.redrawStatsTimer = setTimeout(function () {
        vis.redrawStat(ghcs.repo);
        vis.redrawUserCommitDg(ghcs.repo && ghcs.repo.commits ? ghcs.repo.commits.values() : null);
        ghcs.redrawStatsTimer = null;
    }, 100);
}

function getUserRepo() {
    return ghcs.login + "/" + ghcs.repo.name;
}

function runShow() {
  vis.runShow(lucasData);
}

function redrawRepos() {
    if (ghcs.redrawReposTimer) {
        clearTimeout(ghcs.redrawReposTimer);
        ghcs.redrawReposTimer = null;
    }
    ghcs.redrawReposTimer = setTimeout(function () {
        var repos = ghcs.users
            && ghcs.users[ghcs.login]
            && ghcs.users[ghcs.login].repos
            ? ghcs.users[ghcs.login].repos
            : null;

        vis.redrawRepos(repos);

        vis.redrawLangHg(repos
            ? d3.nest().key(function(d) { return d.nodeValue.lang; }).entries(ghcs.users[ghcs.login].repos)
            : null);

        divStat.updateInfo();

        refreshRepoList(repos);

        ghcs.redrawReposTimer = null;
    }, 100);
}

function meiRepo(d) {
    d._g
        && d._g.selectAll("circle")
        .style("stroke", d3.rgb(colors.decolor).darker())
        .style("fill", toRgba(colors.decolor, vis.forceRep.opt(vis.forceRep.radO(d))))
    && d._g.selectAll("text")
        .style("fill", d3.rgb(colors.decolor).darker());
}

function moiRepo(d) {
    var sel = vis.forceRep.selected == d;

    d._g
        && d._g.selectAll("circle")
        .style("stroke", d3.rgb(vis.forceRep.colors(d.nodeValue.lang)))
        .style("fill",
            sel
            ? d3.rgb(vis.forceRep.colors(d.nodeValue.lang)).brighter()
            : toRgba(vis.forceRep.colors(d.nodeValue.lang), vis.forceRep.opt(vis.forceRep.radO(d))))
    && d._g.selectAll("text")
        .style("fill",
            sel
            ? d3.rgb(vis.forceRep.colors(d.nodeValue.lang)).darker()
            : d3.rgb(vis.forceRep.colors(d.nodeValue.lang)).brighter());
}

function meForks(d) {
    vis.forceRep && vis.forceRep.nodes()
        .filter(function(d) {
            return !d.nodeValue.forked;
        })
        .forEach(meiRepo);
}

function meSources(d) {
    vis.forceRep && vis.forceRep.nodes()
        .filter(function(d) {
            return d.nodeValue.forked;
        })
        .forEach(meiRepo);
}

function meFS() {
    vis.forceRep.nodes().forEach(moiRepo);
}

function fSource(d) {
    return !d.nodeValue.forked;
}

function fFork(d) {
    return d.nodeValue.forked;
}

function refreshRepoList(data) {
    var now = Date.now(),
        lenYear = 365 * ONE_DAY,
        format = d3.format(".2f"),
        x = d3.scale.linear().range([3, 50]);


    function name(d) {
        return d.nodeValue.name;
    }

    function size(d) {
        return d ? (now - d.nodeValue.cdate)/lenYear : 0;
    }

    function age(d) {
        return format((now - d.nodeValue.cdate)/lenYear);
    }

    function titleAge(d) {
        return "age " + age(d) + " of year."
    }

    function color(d) {
        return vis.forceRep.colors(d.nodeValue.lang);
    }

    function darker(d) {
        return d3.rgb(color(d)).darker().darker();
    }

    function sort(a,b) {
        return d3.ascending(a.nodeValue.name.toLowerCase(), b.nodeValue.name.toLowerCase());
    }

    function width(d) {
        return x(size(d)) + "px";
    }

    function star(d) {
        return d.nodeValue.watchers;
    }

    function fork(d) {
        return d.nodeValue.forks;
    }

    function chCheck(d) {
        if (this.id.lastIndexOf("self-repo") > -1) {
            repoList.selectAll("li").filter(fSource)
                .style("display", this.checked ? null : "none");
            vis.hideShowSourceRepos(!this.checked);
        }
        else {
            repoList.selectAll("li").filter(fFork)
                .style("display", this.checked ? null : "none");
            vis.hideShowForkRepos(!this.checked);
        }
    }

    function append(span) {
        span.append("span")
            .attr("class", "sRepoAge")
            .text(age)
            .attr("title", titleAge)
            .style("background", color)
            .style("border-color", darker);
        span.append("span")
            .text(name);
        span.append("span").attr("class", "sRepoRating").call(appendStat);
    }

    function appendStat(span) {
        span.append("span")
            .attr("class", "mini-icon mini-icon-star");
        span.append("span")
            .attr("class", "stars")
            .text(star);

        span.append("span")
            .attr("class", "forks")
            .text(fork);
        span.append("span")
            .attr("class", "mini-icon mini-icon-public-fork");
    }

    d3.select(repoList.node().parentNode.parentNode.parentNode).call(function(ul) {
        var user = ghcs.users[ghcs.login];
        if (!user || !user.info.forks)
            return;

        ul.selectAll(".statForked").remove();

        ul = ul.insert("ul", ".group")
            .attr("class", "group statForked");

        ul.append("li")
            .on("mouseover", meSources)
            .on("mouseout", meFS)
            .attr("class", "field")
            .call(function(li) {
                li.append("input")
                    .attr({
                        "type" : "checkbox",
                        "checked" : "checked",
                        "id" : "cb-for-self-repo"
                    })
                    .on("change", chCheck);
                li = li.append("label")
                    .attr("for", "cb-for-self-repo");
                li.append("span")
                    .attr("class", "mini-icon mini-icon-public-repo");
                li.append("span")
                    .text("Sources: ");
                li.append("strong")
                    .text(user.info.public_repos - user.info.forks);
            });
        ul.append("li")
            .on("mouseover", meForks)
            .on("mouseout", meFS)
            .attr("class", "field")
            .call(function(li) {
                li.append("input")
                    .attr({
                        "type" : "checkbox",
                        "checked" : "checked",
                        "id" : "cb-for-fork-repo"
                    })
                    .on("change", chCheck);
                li = li.append("label")
                    .attr("for", "cb-for-fork-repo");
                li.append("span")
                    .attr("class", "mini-icon mini-icon-repo-forked");
                li.append("span")
                    .text("Forks: ");
                li.append("strong")
                    .text(user.info.forks);
            });
    });

    var opts = repoList.selectAll("li")
        .data(data, function(d) {
            return d.nodeValue.id;
        });

    opts.enter()
        .append("li")
        .on("click", repoItemClick)
        .on("mouseover", repoItemOver)
        .on("mouseout", repoItemOut)
        .append("span")
        .attr("class", "rItemBase")
        .call(append)
    ;

    opts.exit().remove();

    opts.sort(sort);

    opts = repoList.selectAll("li");

    x.domain(d3.extent(opts.data(), size));
    opts.selectAll(".sRepoAge")
        .style("padding-left", width);

    var m = 0;
    opts.selectAll(".sRepoRating").each(function(d) {
        m = d3.max([m, this.innerText.length]);
    });
    opts.selectAll(".rItemBase").style("padding-right", (m * 2) + 62 + "px");
}

function repoItemOver(d) {
    if (d && vis.layers.repo.visible) {
        d.fixed = true;
        vis.meRepo(d);
        vis.mtt(d, null, null, {pageX : d.x, pageY : d.y});
    }
}

function repoItemOut(d) {
    if (d) {
        vis.mlRepo(d);
        if (vis.forceRep.selected != d)
            d.fixed = 0;
    }
}

function repoItemClick(d) {
  if (d) {
    vis.clRepo(d);
  }
}

function getAccessToken(code) {
    d3.xhr(makeOAuthGetAccessTokenUrl(code)).post(function (err, data) {
        if (!err && data && data.responseText) {
            var rt = data.responseText;
            err = rt.indexOf('access_token=') > -1;
            if(err) {
                data = rt.replace(/access_token=(.*?)&.*/, "$1");
                err = data.length > 0;
                if (err) {
                    d3.select("#userOAuth").classed("have", true);
                    ghcs.settings.access.token = data;
                }
            }

            if(!err) {
                log(rt);
            }
        }
        else {
            log(err);
            log(data);
        }
    });
}

function init() {
    if (ghcs.settings.access.code) {
        getAccessToken(code);
        delete ghcs.settings.access.code;
    }
    else
        d3.select("#userOAuth").classed("have", !!ghcs.settings.access.token);

    d3.select(window).on("focus", function() {
        if (window.hasOwnProperty("needPlayShow")) {
//            log("focus window. need play show :" + window.needPlayShow);
            if (window.needPlayShow)
                startShow();
            delete window.needPlayShow;
        }
    });

    d3.select(window).on("blur", function() {
        if (window.hasOwnProperty("needPlayShow"))
            return;

        window.needPlayShow = vis.showIsRun() && !vis.showIsPaused();
//        log("blur window. need play show :" + window.needPlayShow);
        if (window.needPlayShow)
            pauseShow();
    });

    var body = d3.select(document.body);
    body.classed("opera", !!window.opera);

    body.selectAll("a").attr("target", "_blank");

    var sms = d3.select("#sms").append("div");

    criticalError = d3.select("#ex-limit");
    criticalError.hide = function() {
        criticalError.visible = false;
        criticalError.style("display", "none");
        return criticalError;
    };
    criticalError.show = function() {
        criticalError.visible = true;
        criticalError.style("display", null);
        return criticalError;
    };
    criticalError.hide();

    criticalError.select("button")
        .on("click", function() {
            criticalError.hide();
            ghcs.states.cur = ghcs.states.max;
            checkCompleted();
        })
    ;

    log = (function () {
        var logCont = d3.select("#console")
            .append("ul");
        return function (msg) {
            console.log("error", msg);
            if (msg instanceof Event) {
                msg = "error loading";
            }
            else if (msg instanceof TypeError) {
                msg = msg.message;
            }
            else if (msg.data && msg.data.message) {
                msg = msg.meta.status + ': ' + msg.data.message;
            }
            else {
                try {
                    msg = JSON.stringify(msg);
                }
                catch(e) {
                    console.log(e);
                    msg = msg.toString();
                }
                msg = "other: " + msg;
            }
            logCont.append("li").style("max-width", w/2 + "px").text(msg);
            sms.append("div")
                .append("span")
                .style("max-width", 0 + "px")
                .style("opacity", 0)
                .text(msg)
                .transition()
                .duration(3000)
                .style("max-width", w + "px")
                .style("opacity", 1)
                .transition()
                .delay(5000)
                .duration(3000)
                .style("opacity", 0)
                .remove()
            ;
            if(msg.indexOf('API Rate Limit Exceeded') >= 0) {
                ldrTop.show();
                criticalError.show();
            }
        }
    })();

    cs = d3.select("#canvas");
    cs.hide = function() {
        cs.style("display", "none");
        vis.inited && vis.layers.show.hide();
        return cs;
    };
    cs.show = function() {
        cs.style("display", null);
        vis.inited && vis.layers.show.show();
        return cs;
    };

    svg_cs = d3.select("#svg");
    svg = svg_cs.append("svg");
    w = svg.property("clientWidth") || document.body.clientWidth;
    h = svg.property("clientHeight")|| document.body.clientHeight;

    svg.attr("width", w).attr("height", h);

    d3.selectAll("input").datum(function() {
        var obj = null;
        if (this.dataset && this.dataset.ns) {
            var reg = new RegExp("(cb|n|txt)-" + this.dataset.ns + "-");
            obj = {
                ns : ghcs.settings[this.dataset.ns],
                key : this.id.replace(reg, "")
            };
            if (this.type == "checkbox") {
                this.checked = obj.ns[obj.key];
            }
            else {
                this.value = obj.ns[obj.key];
            }
        }
        return obj;
    });

    d3.selectAll("input[type=checkbox]").on("change", chCheckbox);
    d3.selectAll("input[type=number], input[type=text]").on("change", chValue);

    repoList = d3.select("#repo-list");

    psBar = d3.select("#progressBar");
    psBar.pntNode = d3.select(psBar.node().parentNode);
    psBar.show = function() {
        psBar.pntNode.style("display", null);
        return psBar;
    };
    psBar.hide = function() {
        psBar.pntNode.style("display", "none");
        return psBar;
    };
    psBar.setLabel = function(lbl) {
        psBar.text(lbl);
        return psBar;
    };
    psBar.setPos = function(pos) {
        psBar.style("width", pos);
        return psBar;
    };

    stepsBar = d3.select(".steps");
    stepsBar.firstStep = function() {
        stepsBar.attr("class", "steps sfirst");
        return stepsBar;
    };
    stepsBar.secondStep = function() {
        stepsBar.attr("class", "steps ssecond");
        return stepsBar;
    };
    stepsBar.thirdStep = function() {
        stepsBar.attr("class", "steps");
        return stepsBar;
    };

    runBtn = d3.select("#runBtn");
    showBtn = d3.select("#showBtn");
    visBtn = d3.select("#visBtn");
    userTxt = d3.select("#user").on("change", function() {
        stepsBar.firstStep();
        showBtn.disable();
        if (this.value) {
            if (this.value != ghcs.login)
                showBtn.enable();
            else
                stepsBar.secondStep();
        }

        (ghcs.params || (ghcs.params = {})).user = this.value;
    });

    [runBtn, showBtn, userTxt, visBtn].forEach(function(item) {
        item.enable = function () {
            item.attr("disabled", null);
            return item;
        };
        item.disable = function () {
            item.attr("disabled", "disabled");
            return item;
        };
    });

    function startShow() {
        visBtnRestart.hide();
        visBtn.hide();
        visBtnPause.show();
        visBtnStop.show();
        cbDlvml.check();
        if (vis.showIsPaused())
            vis.resumeShow();
        else
            runShow();
    }
    visBtn.on('click', startShow);

    runBtn.on("click", rewriteHash);
    showBtn.on("click", rewriteHash);

    ldrTop = d3.select("#ldrTop");
    ldrTop.pntNode = d3.select(ldrTop.node().parentNode);
    ldrTop.show = function () {
        ldrTop.pntNode.style("display", null);
        return ldrTop;
    };
    ldrTop.hide = function () {
        ldrTop.pntNode.style("display", "none");
        return ldrTop;
    };

    toolTip = d3.select("#tooltip");
    toolTip.show = function () {
        toolTip.style("display", "block");
        return toolTip;
    };
    toolTip.hide = function () {
        toolTip.style("display", null);
        return toolTip;
    };

    cbDlr = d3.select("#cb-dlr").datum("repo");
    cbDlsr = d3.select("#cb-dlsr").datum("stat");
    cbDlvml = d3.select("#cb-dlvml").datum("show");

    [cbDlr, cbDlsr, cbDlvml].forEach(function(item) {
        item.check = function() {
            item.property("checked", true);
            chCheckbox.apply(item.node());
        };

        item.uncheck = function() {
            item.property("checked", false);
            chCheckbox.apply(item.node());
        };

        item.trigger = function() {
            item.property("checked", !item.property("checked"));
            chCheckbox.apply(item.node());
        };
    });

    d3.select("#txt-lc").on("change", function() {
        (ghcs.params || (ghcs.params = {})).climit = +this.value;
        if (ghcs.params.climit < 1)
            ghcs.params.climit = ghcs.limits.commits;
    });

    initGraphics(svg);

    curRep = d3.select("#curRep")
        .on("mouseover", repoItemOver)
        .on("mouseout", repoItemOut);

    curRep.setName = function(r) {
        curRep.selectAll("*").remove();
        curRep.datum(r);
        if (!r)
            curRep.append("span")
                .text("Select Repo...");
        else {
            curRep.append("span")
                .style("color", d3.rgb(vis.forceRep.colors(r.nodeValue.lang)).brighter())
                .attr("class", "mega-icon mega-icon-" + (!r.nodeValue.forked ? "public-repo" : "repo-forked"));

            curRep.append("strong")
                .style("margin-right", "5px")
                .style("text-shadow", "0 0 3px rgba(0, 0, 0, 1)")
                .style("color", d3.rgb(vis.forceRep.colors(r.nodeValue.lang)).brighter())
                .text((r.nodeValue.name || ""));

            curRep.append("a")
                .attr("target", "_blank")
                .attr("title", "Go to Github")
                .attr("href", (r.nodeValue.html_url || "#"))
                .attr("class", "mega-icon mini-icon-link a-icon");
        }

        return curRep;
    };

    divStat = d3.select("#divStat");
    divStat.updateInfo = function() {
        var user;
        if (ghcs.login && (user = ghcs.user = ghcs.users[ghcs.login]) && user.info) {
            if (user.repos) {
                user.info.forks = user.repos.reduce(function(a, b) {
                    return b.nodeValue.forked ? ++a : a;
                }, 0);
            }

            divStat.selectAll("*").remove();
            user.info.avatar && divStat.node().appendChild(user.info.avatar);
            divStat.append("ul")
                .call(function(ul) {
                    (user.info.name || user.info.login) && ul.append("li").call(function(li) {
                        li.append("h1")
                            .text((user.info.name || user.info.login))
                            .append("a")
                            .attr("class", "a-icon")
                            .attr("target", "_blank")
                            .attr("title", "Go to GitHub")
                            .attr("href", user.info.html_url)
                            .append("span")
                            .attr("class", "mini-icon mini-icon-octocat")
                        ;
                        li.append("hr");
                    });
                    user.info.location && ul.append("li")
                        .html("<span class='mini-icon mini-icon-location'></span><strong>" + user.info.location + "</strong>");
                    user.info.blog && ul.append("li")
                        .call(function(li) {
                            li.append("span")
                                .attr("class", "mini-icon mini-icon-link");
                            li.append("a")
                                .attr("target", "_blank")
                                .attr("href", user.info.blog)
                                .text(user.info.blog)
                        });
                    ul.append("li")
                        .on("mouseover", meSources)
                        .on("mouseout", meFS)
                        .call(function(li) {
                            li.append("span")
                                .attr("class", "mini-icon mini-icon-public-repo");
                            li.append("strong")
                                .text(user.info.public_repos - user.info.forks);
                        });
                    user.info.forks && ul.append("li")
                        .on("mouseover", meForks)
                        .on("mouseout", meFS)
                        .call(function(li) {
                            li.append("span")
                                .attr("class", "mini-icon mini-icon-repo-forked");
                            li.append("strong")
                                .text(user.info.forks);
                        });
                    user.info.updated_at && ul.append("li")
                        .call(function(li) {
                            li.append("span")
                                .attr("class", "mini-icon mini-icon-time");
                            li.append("strong")
                                .text(timeFormat(Date.parse(user.info.updated_at)))
                        });
                })
        }
    };

    d3.select("#about").classed("open", true);

    d3.select("#getOAuth").on('click', function() {
        if(!ghcs.settings.access.token) {
            if (window.oauthWindow) {
                window.oauthWindow.focus();
            }
            else {
                window.oauthWindow = window.open(
                    makeOAuthUrl(),
                    'OAuthGitHub',
                    'menubar=false,location=false,resizable=yes,scrollbars=yes,status=yes'
                );
                window.hasOAuth = function(code) {
                    delete window.hasOAuth;
                    delete window.oauthWindow;
                    getAccessToken(code);
                };
            }
        }
        else {
            d3.select("#userOAuth").classed("have", false);
            delete ghcs.settings.access.token;
        }
    });

}
