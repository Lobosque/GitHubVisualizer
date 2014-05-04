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

var cs, svg_cs, svg,
    margin = {top: 20, right: 20, bottom: 20, left: 20},
    w, h, stackLoad = 0,
    psBar,
    stepsBar;

function updateStatus(pos, label) {
    pos = pos > ghcs.states.max ? ghcs.states.max : pos;
    psBar.setPos((pos * 100 / (ghcs.states.max || 1)) + "%")
        .setLabel(label || "Completed " + pos + " of " + ghcs.states.max + " commits ...");
}

function runShow(data) {
  vis.runShow(data);
}

function init() {

    var body = d3.select(document.body);
    body.classed("opera", !!window.opera);

    body.selectAll("a").attr("target", "_blank");

    var sms = d3.select("#sms").append("div");

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

    function startShow() {
        if (vis.showIsPaused())
          vis.resumeShow();
        else
          runShow();
    }

    initGraphics(svg);
}
