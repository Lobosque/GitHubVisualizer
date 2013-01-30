/**
 * User: ArtZub
 * Date: 23.01.13
 * Time: 15:00
 */

"use strict";

(function(vis) {
    var _worker, _data,
        authorHash, filesHash, extHash,
        _force, _forceAuthor, dateRange, nodes,
        groups,
        visTurn, layer, pause, stop,
        works, workAuth, links, lines,
        canvas, ctx, bufCanvas, bufCtx,
        valid = false,
        particle,
        defImg,
        setting = ghcs.settings.code_swarm,
        lcom, lleg, lhis,
        rd3 = d3.random.irwinHall(8);

    var extColor = d3.scale.category20(),
        userColor = d3.scale.category20b();

    var typeNode = {
        author : 0,
        file : 1
    };

    function reCalc(d) {
        if (stop)
            return;

        lcom.showCommitMessage(d.message);

        var l = d.nodes.length,
            n, a;

        a = d.cuserNode ? d.cuserNode : d.userNode;
        a.fixed = false;

        if (!l)
            console.log(d);
        else {
            a.alive = setting.userLife;
            a.opacity = 100;
            a.flash = 100;
            a.visible = true;
        }

        while(--l > -1) {
            n = d.nodes[l];
            n.size += 2;
            n.fixed = false;

            n.author =  a.nodeValue.email;

            n.visible = !!n.statuses[d.sha].status;
            if (n.visible) {
                n.flash = 100;
                n.alive = setting.fileLife > 0 ? setting.fileLife : 1;
                n.opacity = 100;
            }
            else {
                n.alive = (setting.fileLife > 0 ? setting.fileLife : 1) * .2;
                n.opacity = 50;
            }

            /*data.push(n);

            if (d.cuserNode) {
                links.push({
                    source : n,
                    target : d.cuserNode
                });
            }

            links.push({
                source : n,
                target : d.userNode
            });*/
        }

        works = nodes.filter(function(d) {
            return d.type != typeNode.author && (d.visible || d.opacity);
        });
        _force.nodes(works).start();

        workAuth = nodes.filter(function(d) {
            return d.type == typeNode.author && (d.visible || d.opacity);
        });
        _forceAuthor.nodes(workAuth).start();
    }

    function loop() {

        if (pause)
            return;

        var dl, dr;

        dl = dateRange[0];
        dr = dl + ghcs.limits.stepShow * ghcs.limits.stepType;
        dateRange[0] = dr;

        visTurn = _data.filter(function (d) {
            return d.date >= dl && d.date < dr;
        });

        ghcs.asyncForEach(visTurn, reCalc, ONE_SECOND / (visTurn.length > 1 ? visTurn.length : ONE_SECOND));
        //visTurn.forEach(reCalc);


        updateStatus(ghcs.states.cur += ghcs.limits.stepShow * ghcs.limits.stepType, timeFormat(new Date(dr)));

        if (dl >= dateRange[1]) {
            if (_worker)
                clearInterval(_worker);
        } else {
            if (!visTurn.length && setting.skipEmptyDate)
                loop();
        }
    }

    function run() {
        if (_worker)
            clearInterval(_worker);

        anim();

        _worker = setInterval(loop, ONE_SECOND);
    }

    function nr(d) {
        return d.size > 0 ? d.size : 0;
    }

    function ncb(d) {
        return d3.rgb(d.color).brighter().brighter();
    }

    function nc(d) {
        return d.color;
    }

    function randomTrue() {
        return Math.floor(rd3() * 8) % 2;
    }

    function radius(d) {
        return Math.sqrt(d) * (setting.showHalo ? 8 : 1);
    }

    function node(d, type) {
        var c = type == typeNode.file ? d.name : userColor(d.email),
            ext, x, y,
            w2 = w/2,
            w5 = w/5,
            h2 = h/2,
            h5 = h/5;
        if (type == typeNode.file) {
            c = c && c.match(/.*(\.\w+)$/) ? c.replace(/.*(\.\w+)$/, "$1") : "Mics";
            ext = extHash.get(c);
            if (!ext) {
                ext = {
                    all : 0,
                    currents : {},
                    color : extColor(c)
                };
                extHash.set(c, ext);
            }
            ext.all++;
            c = ext.color;
        }

        x = w * Math.random();
        y = h * Math.random();

        if (type == typeNode.author) {
            if (randomTrue()) {
                x = x > w5 && x < w2
                    ? x / 5
                    : x > w2 && x < w - w5
                    ? w - x / 5
                    : x
                ;
            }
            else {
                y = y > h5 && y < h2
                    ? y / 5
                    : y > h2 && y < h - h5
                    ? h - y / 5
                    : y
                ;
            }
        }

        return {
            x : x,
            y : y,
            id : type + (type == typeNode.file ? d.name : d.email),
            size : type != typeNode.file ? 24 : 2,
            weight : type != typeNode.file ? 24 : 2,
            fixed : true,
            visible : false,
            links : 0,
            type : type,
            color : c,
            ext : ext,
            author : type == typeNode.author ? d.email : null,
            img : type == typeNode.author ? d.avatar : null,
            nodeValue : d
        }
    }

    function getAuthor(d) {
        if (!d || !d.author)
            return null;

        var n = authorHash.get(d.author.email);

        if (!n) {
            n = node(d.author, typeNode.author);
            authorHash.set(d.author.email, n);
        }
        return n;
    }

    function getFile(d) {
        if (!d || !d.name)
            return null;

        var n = filesHash.get(d.name);

        if (!n) {
            n = node(d, typeNode.file);
            n.links = 1;
            filesHash.set(d.name, n);
        }
        return n;
    }

    function initNodes(data) {
        var ns = [],
            i, j, n, d, df;
        authorHash = d3.map({});
        filesHash = d3.map({});
        extHash = d3.map({});

        if (data) {
            i = data.length;
            while(--i > -1) {
                d = data[i];
                d.nodes = [];
                if (!d) continue;

                n = getAuthor(d);
                d.userNode = n;
                !n.inserted && (n.inserted = ns.push(n));

                if (d.author.login != d.committer.login) {
                    n = getAuthor(d);
                    d.cuserNode = n;

                    !n.inserted && (n.inserted = ns.push(n));

                    /*links.push({
                        source : d.userNode,
                        target : d.cuserNode
                    })*/
                }

                if (!d.files) continue;

                j = d.files.length;
                while(--j > -1) {
                    df = d.files[j];
                    if (!df) continue;

                    n = getFile(df);
                    d.nodes.push(n);
                    n.statuses = n.statuses || {};
                    n.statuses[d.sha] = df;
                    n.ext.currents[d.sha] += 1;
                    !n.inserted && (n.inserted = ns.push(n));
                }
            }
        }
        return ns;
    }

    var tempCanvas, tempFileCanvas;
    function setOpacity(img, a, f) {
        if (!img || !img.width)
            img = defImg;

        return img;

        if (!tempCanvas) {
            tempCanvas = document.createElement("canvas");
        }

        tempCanvas.width = img.width;
        tempCanvas.height = img.height;

        var imgCtx = tempCanvas.getContext("2d"), imgdata, i, r;
        imgCtx.save();
        imgCtx.drawImage(img, 0, 0);

        imgdata = imgCtx.getImageData(0, 0, img.width, img.height);

        i = (f || a < 1) ? imgdata.data.length : 0;
        while((i -= 4) > -1) {
            if (false && f) {
                r = d3.rgb(imgdata.data[i], imgdata.data[i + 1], imgdata.data[i + 2]).brighter();
                imgdata.data[i] = r.r;
                imgdata.data[i + 1] = r.g;
                imgdata.data[i + 2] = r.b;
            }
            if (a < 1)
                imgdata.data[i + 3] *= a;
        }

        imgCtx.putImageData(imgdata, 0, 0);
        imgCtx.restore();
        return tempCanvas;
    }

    function colorize(img, r, b, g, a) {
        if (!img)
            return img;

        if (!tempFileCanvas) {
            tempFileCanvas = document.createElement("canvas");
            tempFileCanvas.width = img.width;
            tempFileCanvas.height = img.height;
        }

        var imgCtx = tempFileCanvas.getContext("2d"), imgdata, i;
        imgCtx.clearRect(0, 0, img.width, img.height);
        imgCtx.save();
        imgCtx.drawImage(img, 0, 0);

        imgdata = imgCtx.getImageData(0, 0, img.width, img.height);

        i = imgdata.data.length;
        while((i -= 4) > -1) {
            imgdata.data[i + 3] = imgdata.data[i] * a;
            imgdata.data[i] = r;
            imgdata.data[i + 1] = g;
            imgdata.data[i + 2] = b;
        }

        imgCtx.putImageData(imgdata, 0, 0);
        imgCtx.restore();
        return tempFileCanvas;
    }

    function redrawCanvas() {

        //TODO: optimize this code

        bufCtx.save();
        bufCtx.clearRect(0, 0, w, h);

        var n = d3.nest()
                .key(function(d) {
                    return d.opacity;
                })
                .key(function(d) {
                    return d.flash ? ncb(d) : d3.rgb(nc(d));
                })
                .entries(_force.nodes())
                ,
            l = n.length, i, j,
            img,
            d, d1, d2,
            c, x, y, s;

        while(--l > -1) {
            d1 = n[l];
            i = d1.values.length;
            while(--i > -1) {
                d2 = d1.values[i];
                j = d2.values.length;

                c = d3.rgb(d2.key);

                if (!setting.showHalo) {
                    bufCtx.beginPath();
                    bufCtx.strokeStyle = "none";
                    bufCtx.fillStyle = toRgba(c, d1.key * .01);
                }
                else
                    img = colorize(particle, c.r, c.g, c.b, d1.key * .01);

                while(--j > -1) {
                    d = d2.values[j];
                    if (d.visible || d.alive) {
                        d.flash = (d.flash -= setting.speedFlash) > 0 ? d.flash : 0;

                        !d.flash && setting.fileLife > 0
                            && (d.alive = --d.alive > 0 ? d.alive : 0)
                        ;

                        d.opacity = !d.alive
                            ? ((d.opacity -= setting.speedOpacity) > 0 ? d.opacity : 0)
                            : d.opacity
                        ;

                        d.visible && !d.opacity
                            && (d.visible = false);

                        x = Math.floor(d.x);
                        y = Math.floor(d.y);

                        s = radius(nr(d));
                        setting.showHalo
                            ? bufCtx.drawImage(img, x - s / 2, y - s / 2, s, s)
                            : bufCtx.arc(x, y, s, 0, PI_CIRCLE, true)
                            ;
                    }
                }

                if (!setting.showHalo) {
                    bufCtx.fill();
                    bufCtx.stroke();
                }
            }
        }

        bufCtx.closePath();

        n = _forceAuthor.nodes();
        l = n.length;

        while(--l > -1) {
            d = n[l];
            if (d.visible || d.opacity) {
                d.flash = (d.flash -= setting.speedFlash) > 0 ? d.flash : 0;
                c = d.flash ? "white" : "gray";

                !d.flash && !d.links
                    && (d.alive = --d.alive > 0 ? d.alive : 0);

                d.opacity = !d.alive
                    ? ((d.opacity -= setting.speedOpacity) > 0 ? d.opacity : 0)
                    : d.opacity
                ;

                d.visible && !d.opacity
                    && (d.visible = false);

                x = Math.floor(d.x);
                y = Math.floor(d.y);

                bufCtx.save();

                if (setting.showPaddingCircle) {
                    bufCtx.beginPath();
                    bufCtx.strokeStyle = "none";
                    bufCtx.fillStyle = toRgba("#ff0000", .1);
                    bufCtx.arc(x, y, nr(d) + setting.padding, 0, PI_CIRCLE, true);
                    bufCtx.fill();
                    bufCtx.stroke();
                }

                bufCtx.beginPath();
                bufCtx.strokeStyle = "none";
                bufCtx.fillStyle = setting.useAvatar ? "none" : toRgba(c, d.opacity * .01);
                bufCtx.arc(x, y, nr(d), 0, PI_CIRCLE, true);
                bufCtx.fill();
                bufCtx.stroke();
                if (setting.useAvatar && d.img) {
                    bufCtx.clip();
                    bufCtx.drawImage(setOpacity(d.img, d.opacity * .01, d.flash), x - nr(d), y - nr(d), nr(d) * 2, nr(d) * 2);
                }
                bufCtx.closePath();

                bufCtx.restore();

                bufCtx.save();

                bufCtx.fillStyle = toRgba(c, d.opacity * .01);
                bufCtx.fillText(setting.labelPattern
                    .replace("%n", d.nodeValue.name != "unknown" ? d.nodeValue.name : d.nodeValue.login)
                    .replace("%e", d.nodeValue.email), x, y + nr(d) * 1.5);

                bufCtx.restore();
            }
        }

        bufCtx.restore();
    }

    function anim() {
        requestAnimationFrame(anim);
        if (valid)
            return;

        valid = true;

        ctx.save();
        ctx.clearRect(0, 0, w, h);

        redrawCanvas();

        ctx.drawImage(bufCanvas, 0, 0);
        ctx.restore();

        valid = false;
    }

    function tick() {
        if (_force.nodes()) {

            _force.nodes()
                .forEach(cluster(0.025));

            /*_force.nodes()
                .forEach(collide(.5, d3.geom.quadtree(_force.nodes())));*/

            _forceAuthor.nodes(
                _forceAuthor.nodes()
                    .filter(function(d) {
                        if (d.visible && d.links === 0) {
                            d.visible = false;
                            d.flash = 0;
                            d.alive = 0;
                        }
                        return d.visible;
                    })
            );
        }

        _forceAuthor.resume();
        _force.resume();
    }

    // Move d to be adjacent to the cluster node.
    function cluster(alpha) {

        authorHash.forEach(function(k, d) {
            d.links = 0;
        });

        return function(d) {
            if (!d.author || !d.visible)
                return;

            var node = authorHash.get(d.author),
                l,
                r,
                x,
                y;

            if (node == d) return;
            node.links++;

            x = d.x - node.x;
            y = d.y - node.y;
            l = Math.sqrt(x * x + y * y);
            r = radius(nr(d)) / 2 + (nr(node) + setting.padding);
            if (l != r) {
                l = (l - r) / (l || 1) * (alpha || 1);
                x *= l;
                y *= l;

                d.x -= x;
                d.y -= y;
            }
        };
    }

    // Resolves collisions between d and all other circles.
    function collide(alpha, quadtree) {
        return function(d) {
            if(!d.visible || !d.links || d.type != typeNode.file)
                return;

            var r = radius(nr(d)) + 3 * setting.padding,
                nx1 = d.x - r,
                nx2 = d.x + r,
                ny1 = d.y - r,
                ny2 = d.y + r;
            quadtree.visit(function(quad, x1, y1, x2, y2) {
                if (quad.point
                    && quad.point.type == typeNode.file
                    && quad.point.visible
                    && (quad.point !== d)
                    && d.author !== quad.point.author) {
                    var x = d.x - quad.point.x,
                        y = d.y - quad.point.y,
                        l = Math.sqrt(x * x + y * y),
                        r = (radius(nr(d)) + radius(nr(quad.point))) +
                            /*(d.author !== quad.point.author && d.type == typeNode.file) **/ setting.padding ;
                    if (l < r) {
                        l = (l - r) / (l || 1) * (alpha || 1);

                        x *= l;
                        y *= l;

                        if(d.type == typeNode.file) {
                            d.x -= x;
                            d.y -= y;
                        }

                        quad.point.x += x;
                        quad.point.y += y;
                    }
                }
                return x1 > nx2
                    || x2 < nx1
                    || y1 > ny2
                    || y2 < ny1;
            });
        };
    }

    function updateExtLegend(sha) {
        var data = extHash.forEach(function(k, d) {
            if (d.currents[sha]) {

            }
        })
    }

    vis.runShow = function(data, _laeyr) {
        if (_worker)
            clearInterval(_worker);

        if (!data || !data.commits)
            return;

        vis.layers.repo && cbDlr.uncheck();
        vis.layers.stat && cbDlsr.uncheck();

        dateRange = d3.extent(data.dates);
        visTurn = null;


        layer = d3.select("#canvas");
        layer.select("#mainCanvas").remove();

        canvas = layer.append("canvas")
            .attr("id", "mainCanvas")
            .attr("width", w)
            .attr("height", h)
            .node();

        ctx = canvas.getContext("2d");

        bufCanvas = document.createElement("canvas");
        bufCanvas.width = w;
        bufCanvas.height = h;

        bufCtx = bufCanvas.getContext("2d");

        bufCtx.font = "normal normal " + setting.sizeUser / 2 + "px Tahoma";
        bufCtx.textAlign = "center";

        layer = _laeyr || vis.layers.show;
        layer && layer.show && layer.show();

        lcom = (lcom || layer.append("g")
            .attr("width", 10)
            .attr("height", 14))
            .attr("transform", "translate(" + [w/2, h - 18] + ")")
            ;


        lcom.visible = setting.showCommitMassage;

        lcom.selectAll("text").remove();
        lcom.showCommitMessage = function(text) {
            if (setting.showCommitMassage && !lcom.visible) {
                lcom.visible = true;
                lcom.style("display", null);
            }
            else if (!setting.showCommitMassage && lcom.visible) {
                lcom.visible = false;
                lcom.style("display", "none");
            }

            lcom.append("text")
                .attr("text-anchor", "middle")
                .attr("class", "com-mess")
                .attr("transform", "translate("+ [0, -lcom.node().childElementCount * 14] +")")
                .text(text.split("\n")[0].substr(0, 100))
                .transition()
                .delay(500)
                .duration(2000)
                .style("fill-opacity", 1)
                .duration(200)
                .style("font-size", "11.2pt")
                .transition()
                .duration(1500)
                .style("fill-opacity", .3)
                .style("font-size", "11pt")
                /*.duration(500)
                .attr("transform", function(d, i) { return "translate("+ [0, -i * 14] +")"; })*/
                .each("end", function() {
                    lcom.selectAll("text").each(function(d, i) {
                        d3.select(this)
                            .attr("transform", "translate("+ [0, -i * 14] +")");
                    });
                })
                .remove();
            /*this.transition()
                .attr("transform", "translate("+ [w/2, h - th] +")");*/
        };

        psBar.show();
        ghcs.states.cur = 0;
        ghcs.states.max = dateRange[1] - dateRange[0];
        updateStatus(ghcs.states.cur, timeFormat(new Date(dateRange[0])));


        links = [];
        nodes = initNodes(_data = data.commits.slice(0).sort(vis.sC));

        defImg = new Image();
        defImg.src = "default.png";

        particle = new Image();
        particle.src = "particle.png";

        _force = (_force || d3.layout.force()
            .stop()
            .size([w, h])
            .friction(.75)
            .gravity(0)
            .charge(-2)
            .on("tick", tick))
            .nodes(works = [])
            .start()
            .stop();

        _forceAuthor = (_forceAuthor || d3.layout.force()
            .stop()
            .size([w, h])
            .gravity(setting.padding * .001)
            .charge(function(d) { return -(setting.padding + d.size) * 8; }))
            .nodes(workAuth = [])
            .start()
            .stop();

        groups = null;

        stop = false;
        pause = false;

        run();
        _force.start();
        _forceAuthor.start();
    };

    vis.pauseShow = function() {
        pause = true;
    };

    vis.stopShow = function() {
        stop = true;
        if (_worker)
            clearInterval(_worker);
    };

    vis.resumeShow = function() {
        pause = false;
    };
})(vis || (vis = {}));