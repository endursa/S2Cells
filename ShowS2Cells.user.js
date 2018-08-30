// ==UserScript==
// @id             iitc-plugin-S2Cells@Endursa
// @name           IITC plugin: Show S2 Cells
// @author         Endursa
// @category       Layer
// @version        0.2
// @namespace      https://github.com/endursa
// @updateURL      https://github.com/endursa/S2Cells/raw/master/ShowS2Cells.user.js
// @downloadURL    https://github.com/endursa/S2Cells/raw/master/ShowS2Cells.user.js
// @description    IITC: Shows S2 Cells on the map, level can be chosen
// @include        https://*.ingress.com/intel*
// @include        http://*.ingress.com/intel*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @include        https://*.ingress.com/mission/*
// @include        http://*.ingress.com/mission/*
// @match          https://*.ingress.com/mission/*
// @match          http://*.ingress.com/mission/*
// @grant          none
// ==/UserScript==

// This plugin is a simple fork of the Regions plugin by Jonatkins
//
// original plugin at:
// https://github.com/jonatkins/ingress-intel-total-conversion


function wrapper(plugin_info) {
  // ensure plugin framework is there, even if iitc is not yet loaded
  if(typeof window.plugin !== 'function') window.plugin = function() {};

  //PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
  //(leaving them in place might break the 'About IITC' page or break update checks)
  plugin_info.buildName = 'S2Cells';
  plugin_info.dateTimeVersion = '20180723.13337';
  plugin_info.pluginId = 'S2Cells';
  //END PLUGIN AUTHORS NOTE



  // PLUGIN START ////////////////////////////////////////////////////////

  // use own namespace for plugin
  window.plugin.showS2Cells = function() {};

  /*levels
   lvl 6 cells determin ingress scores
   lvl 12 cells determine pokemon go ex-raid cells
   lvl 14 cells determine how many pokestops/arenas are converted per portal
      0-1 objects --> 0 gyms
      2-5 objects --> 1 gym
      6-19 objects --> 2 gyms
      20-26 objects --> 3 gyms
      27+ objects --> unknown
   lvl 17 cells determine pokestop/arena density
   lvl 20 cells determine portal density
  */

  var levels = [6,12,14,17,20];
  for(var z = 0; z < levels.length; z++){
      var input=document.createElement("input");
      var label=document.createElement("label");
      label.for = "lv" + z;
      label.innerHTML = "LvL " + levels[z];
      input.type="checkbox";
      input.id = 'lv' + z;
      input.onclick = setCellLevel;
      label.setAttribute("style", "font-size:13px;position:absolute;bottom:" + ((z+6)*20) + "px;left:10px;color:black;cursor:pointer;pointer-events:all;z-index:2999;");
      input.setAttribute("style", "font-size:18px;position:absolute;bottom:" + ((z+6)*20) + "px;left:50px;color:black;cursor:pointer;pointer-events:all;z-index:2999;");
      document.body.appendChild(label);
      document.body.appendChild(input);
  }

  function setCellLevel(){
      window.plugin.showS2Cells.cellLevel = [];
      for(var z = 0; z < levels.length ; z++){
          if(document.getElementById("lv" + z).checked){
              window.plugin.showS2Cells.cellLevel.push(levels[z]);
          }
      }
      window.plugin.showS2Cells.update();
  }

/*  window.plugin.showS2Cells.onBtnClick = function(e) {
	var btn = window.plugin.showS2Cells.button,
		tooltip = window.plugin.showS2Cells.tooltip,
		layer = window.plugin.showS2Cells.layer;
  }
*/
  window.plugin.showS2Cells.setup = function() {
    /// S2 Geometry functions
    // the regional scoreboard is based on a level 6 S2 Cell
    // - https://docs.google.com/presentation/d/1Hl4KapfAENAOf4gv-pSngKwvS_jwNVHRPZTTDzXXn6Q/view?pli=1#slide=id.i22
    // at the time of writing there's no actual API for the intel map to retrieve scoreboard data,
    // but it's still useful to plot the score cells on the intel map


    // the S2 geometry is based on projecting the earth sphere onto a cube, with some scaling of face coordinates to
    // keep things close to approximate equal area for adjacent cells
    // to convert a lat,lng into a cell id:
    // - convert lat,lng to x,y,z
    // - convert x,y,z into face,u,v
    // - u,v scaled to s,t with quadratic formula
    // - s,t converted to integer i,j offsets
    // - i,j converted to a position along a Hubbert space-filling curve
    // - combine face,position to get the cell id

    //NOTE: compared to the google S2 geometry library, we vary from their code in the following ways
    // - cell IDs: they combine face and the hilbert curve position into a single 64 bit number. this gives efficient space
    //             and speed. javascript doesn't have appropriate data types, and speed is not crucical, so we use
    //             as [face,[bitpair,bitpair,...]] instead
    // - i,j: they always use 30 bits, adjusting as needed. we use 0 to (1<<level)-1 instead
    //        (so GetSizeIJ for a cell is always 1)

    (function() {

 /*       $('<style>').prop('type', 'text/css').html('.leaflet-show-S2-Cell a\n{\n	}\n.leaflet-show-S2-Cell a.active\n{\n	background-color: #BBB;\n}\n.leaflet-show-S2-Cell-tooltip\n{\n	background-color: rgba(255, 255, 255, 0.6);\n	display: none;\n	height: 24px;\n	left: 30px;\n	line-height: 24px;\n	margin-left: 15px;\n	margin-top: -12px;\n	padding: 0 10px;\n	position: absolute;\n	top: 50%;\n	white-space: nowrap;\n	width: auto;\n}\n.leaflet-show-S2-Cell a.active .leaflet-show-S2-Cell-tooltip\n{\n	display: block;\n}\n.leaflet-show-S2-Cell-tooltip:before\n{\n	border-color: transparent rgba(255, 255, 255, 0.6);\n	border-style: solid;\n	border-width: 12px 12px 12px 0;\n	content: "";\n	display: block;\n	height: 0;\n	left: -12px;\n	position: absolute;\n	width: 0;\n}\n').appendTo('head');

        var parent = $(".leaflet-top.leaflet-left", window.map.getContainer());

        var button = document.createElement("a");
        button.className = "leaflet-bar-part";
        button.addEventListener("click", window.plugin.showS2Cells.onBtnClick, false);
        button.title = 'Show S2 Cells';

        var tooltip = document.createElement("div");
        tooltip.className = "leaflet-show-S2-Cell-tooltip";
        button.appendChild(tooltip);

        var container = document.createElement("div");
        container.className = "leaflet-show-S2-Cell leaflet-bar leaflet-control";
        container.appendChild(button);
        parent.append(container);

        window.plugin.showS2Cells.button = button;
        window.plugin.showS2Cells.tooltip = tooltip;
        window.plugin.showS2Cells.container = container;
*/
      window.S2 = {};


      var LatLngToXYZ = function(latLng) {
        var d2r = Math.PI/180.0;

        var phi = latLng.lat*d2r;
        var theta = latLng.lng*d2r;

        var cosphi = Math.cos(phi);

        return [Math.cos(theta)*cosphi, Math.sin(theta)*cosphi, Math.sin(phi)];
      };

      var XYZToLatLng = function(xyz) {
        var r2d = 180.0/Math.PI;

        var lat = Math.atan2(xyz[2], Math.sqrt(xyz[0]*xyz[0]+xyz[1]*xyz[1]));
        var lng = Math.atan2(xyz[1], xyz[0]);

        return L.latLng(lat*r2d, lng*r2d);
      };

      var largestAbsComponent = function(xyz) {
        var temp = [Math.abs(xyz[0]), Math.abs(xyz[1]), Math.abs(xyz[2])];

        if (temp[0] > temp[1]) {
          if (temp[0] > temp[2]) {
            return 0;
          } else {
            return 2;
          }
        } else {
          if (temp[1] > temp[2]) {
            return 1;
          } else {
            return 2;
          }
        }

      };

      var faceXYZToUV = function(face,xyz) {
        var u,v;

        switch (face) {
          case 0: u =  xyz[1]/xyz[0]; v =  xyz[2]/xyz[0]; break;
          case 1: u = -xyz[0]/xyz[1]; v =  xyz[2]/xyz[1]; break;
          case 2: u = -xyz[0]/xyz[2]; v = -xyz[1]/xyz[2]; break;
          case 3: u =  xyz[2]/xyz[0]; v =  xyz[1]/xyz[0]; break;
          case 4: u =  xyz[2]/xyz[1]; v = -xyz[0]/xyz[1]; break;
          case 5: u = -xyz[1]/xyz[2]; v = -xyz[0]/xyz[2]; break;
          default: throw {error: 'Invalid face'}; break;
        }

        return [u,v];
      }




      var XYZToFaceUV = function(xyz) {
        var face = largestAbsComponent(xyz);

        if (xyz[face] < 0) {
          face += 3;
        }

       var uv = faceXYZToUV (face,xyz);

        return [face, uv];
      };

      var FaceUVToXYZ = function(face,uv) {
        var u = uv[0];
        var v = uv[1];

        switch (face) {
          case 0: return [ 1, u, v];
          case 1: return [-u, 1, v];
          case 2: return [-u,-v, 1];
          case 3: return [-1,-v,-u];
          case 4: return [ v,-1,-u];
          case 5: return [ v, u,-1];
          default: throw {error: 'Invalid face'};
        }
      };


      var STToUV = function(st) {
        var singleSTtoUV = function(st) {
          if (st >= 0.5) {
            return (1/3.0) * (4*st*st - 1);
          } else {
            return (1/3.0) * (1 - (4*(1-st)*(1-st)));
          }
        };

        return [singleSTtoUV(st[0]), singleSTtoUV(st[1])];
      };



      var UVToST = function(uv) {
        var singleUVtoST = function(uv) {
          if (uv >= 0) {
            return 0.5 * Math.sqrt (1 + 3*uv);
          } else {
            return 1 - 0.5 * Math.sqrt (1 - 3*uv);
          }
        };

        return [singleUVtoST(uv[0]), singleUVtoST(uv[1])];
      };


      var STToIJ = function(st,order) {
        var maxSize = (1<<order);

        var singleSTtoIJ = function(st) {
          var ij = Math.floor(st * maxSize);
          return Math.max(0, Math.min(maxSize-1, ij));
        };

        return [singleSTtoIJ(st[0]), singleSTtoIJ(st[1])];
      };


      var IJToST = function(ij,order,offsets) {
        var maxSize = (1<<order);

        return [
          (ij[0]+offsets[0])/maxSize,
          (ij[1]+offsets[1])/maxSize
        ];
      };

      // hilbert space-filling curve
      // based on http://blog.notdot.net/2009/11/Damn-Cool-Algorithms-Spatial-indexing-with-Quadtrees-and-Hilbert-Curves
      // note: rather then calculating the final integer hilbert position, we just return the list of quads
      // this ensures no precision issues whth large orders (S3 cell IDs use up to 30), and is more
      // convenient for pulling out the individual bits as needed later
      var pointToHilbertQuadList = function(x,y,order) {
        var hilbertMap = {
          'a': [ [0,'d'], [1,'a'], [3,'b'], [2,'a'] ],
          'b': [ [2,'b'], [1,'b'], [3,'a'], [0,'c'] ],
          'c': [ [2,'c'], [3,'d'], [1,'c'], [0,'b'] ],
          'd': [ [0,'a'], [3,'c'], [1,'d'], [2,'d'] ]
        };

        var currentSquare='a';
        var positions = [];

        for (var i=order-1; i>=0; i--) {

          var mask = 1<<i;

          var quad_x = x&mask ? 1 : 0;
          var quad_y = y&mask ? 1 : 0;

          var t = hilbertMap[currentSquare][quad_x*2+quad_y];

          positions.push(t[0]);

          currentSquare = t[1];
        }

        return positions;
      };




      // S2Cell class

      S2.S2Cell = function(){};

      //static method to construct
      S2.S2Cell.FromLatLng = function(latLng,level) {

        var xyz = LatLngToXYZ(latLng);

        var faceuv = XYZToFaceUV(xyz);
        var st = UVToST(faceuv[1]);

        var ij = STToIJ(st,level);

        return S2.S2Cell.FromFaceIJ (faceuv[0], ij, level);
      };

      S2.S2Cell.FromFaceIJ = function(face,ij,level) {
        var cell = new S2.S2Cell();
        cell.face = face;
        cell.ij = ij;
        cell.level = level;

        return cell;
      };


      S2.S2Cell.prototype.toString = function() {
        return 'F'+this.face+'ij['+this.ij[0]+','+this.ij[1]+']@'+this.level;
      };

      S2.S2Cell.prototype.getLatLng = function() {
        var st = IJToST(this.ij,this.level, [0.5,0.5]);
        var uv = STToUV(st);
        var xyz = FaceUVToXYZ(this.face, uv);

        return XYZToLatLng(xyz);
      };

      S2.S2Cell.prototype.getCornerLatLngs = function() {
        var result = [];
        var offsets = [
          [ 0.0, 0.0 ],
          [ 0.0, 1.0 ],
          [ 1.0, 1.0 ],
          [ 1.0, 0.0 ]
        ];

        for (var i=0; i<4; i++) {
          var st = IJToST(this.ij, this.level, offsets[i]);
          var uv = STToUV(st);
          var xyz = FaceUVToXYZ(this.face, uv);

          result.push ( XYZToLatLng(xyz) );
        }
        return result;
      };


      S2.S2Cell.prototype.getFaceAndQuads = function() {
        var quads = pointToHilbertQuadList(this.ij[0], this.ij[1], this.level);

        return [this.face,quads];
      };

      S2.S2Cell.prototype.getNeighbors = function() {

        var fromFaceIJWrap = function(face,ij,level) {
          var maxSize = (1<<level);
          if (ij[0]>=0 && ij[1]>=0 && ij[0]<maxSize && ij[1]<maxSize) {
            // no wrapping out of bounds
            return S2.S2Cell.FromFaceIJ(face,ij,level);
          } else {
            // the new i,j are out of range.
            // with the assumption that they're only a little past the borders we can just take the points as
            // just beyond the cube face, project to XYZ, then re-create FaceUV from the XYZ vector

            var st = IJToST(ij,level,[0.5,0.5]);
            var uv = STToUV(st);
            var xyz = FaceUVToXYZ(face,uv);
            var faceuv = XYZToFaceUV(xyz);
            face = faceuv[0];
            uv = faceuv[1];
            st = UVToST(uv);
            ij = STToIJ(st,level);
            return S2.S2Cell.FromFaceIJ (face, ij, level);
          }
        };

        var face = this.face;
        var i = this.ij[0];
        var j = this.ij[1];
        var level = this.level;


        return [
          fromFaceIJWrap(face, [i-1,j], level),
          fromFaceIJWrap(face, [i,j-1], level),
          fromFaceIJWrap(face, [i+1,j], level),
          fromFaceIJWrap(face, [i,j+1], level)
        ];

      };


    })();


    window.plugin.showS2Cells.S2Layer = L.layerGroup();

    $("<style>")
    .prop("type", "text/css")
    .html(".plugin-showS2Cells-name {\
      font-size: 14px;\
      font-weight: bold;\
      color: gold;\
      opacity: 0.7;\
      text-align: center;\
      text-shadow: -1px -1px #000, 1px -1px #000, -1px 1px #000, 1px 1px #000, 0 0 2px #000; \
      pointer-events: none;\
    }")
    .appendTo("head");

    addLayerGroup('S2 Cell overlay', window.plugin.showS2Cells.S2Layer, true);

    map.on('moveend', window.plugin.showS2Cells.update);

    addHook('search', window.plugin.showS2Cells.search);

    window.plugin.showS2Cells.update();
  };

/*  window.plugin.showS2Cells.FACE_NAMES = [ 'AF', 'AS', 'NR', 'PA', 'AM', 'ST' ];
  window.plugin.showS2Cells.CODE_WORDS = [
    'ALPHA',    'BRAVO',   'CHARLIE', 'DELTA',
    'ECHO',     'FOXTROT', 'GOLF',    'HOTEL',
    'JULIET',   'KILO',    'LIMA',    'MIKE',
    'NOVEMBER', 'PAPA',    'ROMEO',   'SIERRA',
  ];

  // This regexp is quite forgiving. Dashes are allowed between all components, each dash and leading zero is optional.
  // All whitespace is removed in onSearch(). If the first or both the first and second component are omitted, they are
  // replaced with the current cell's coordinates (=the cell which contains the center point of the map). If the last
  // component is ommited, the 4x4 cell group is used.
  window.plugin.showS2Cells.REGEXP = new RegExp('^(?:(?:(' + plugin.showS2Cells.FACE_NAMES.join('|') + ')-?)?((?:1[0-6])|(?:0?[1-9]))-?)?(' +
  plugin.showS2Cells.CODE_WORDS.join('|') + ')(?:-?((?:1[0-5])|(?:0?\\d)))?$', 'i');
*/
  // rot and d2xy from Wikipedia
  window.plugin.showS2Cells.rot = function(n, x, y, rx, ry) {
    if(ry == 0) {
      if(rx == 1) {
        x = n-1 - x;
        y = n-1 - y;
      }

      return [y, x];
    }
    return [x, y];
  }
  window.plugin.showS2Cells.d2xy = function(n, d) {
    var rx, ry, s, t = d, xy = [0, 0];
    for(s=1; s<n; s*=2) {
      rx = 1 & (t/2);
      ry = 1 & (t ^ rx);
      xy = window.plugin.showS2Cells.rot(s, xy[0], xy[1], rx, ry);
      xy[0] += s * rx;
      xy[1] += s * ry;
      t /= 4;
    }
    return xy;
  };

  window.plugin.showS2Cells.update = function() {

    window.plugin.showS2Cells.S2Layer.clearLayers();

    var bounds = map.getBounds();

    var seenCells = {};

    var drawCellAndNeighbors = function(cell, colorId) {
      var cellStr = cell.toString();

      if (!seenCells[cellStr]) {
        // cell not visited - flag it as visited now
        seenCells[cellStr] = true;

        // is it on the screen?
        var corners = cell.getCornerLatLngs();
        var cellBounds = L.latLngBounds([corners[0],corners[1]]).extend(corners[2]).extend(corners[3]);

        if (cellBounds.intersects(bounds)) {
          // on screen - draw it
          window.plugin.showS2Cells.drawCell(cell, colorId);

          // and recurse to our neighbors
          var neighbors = cell.getNeighbors();
          for (var i=0; neighbors && i<neighbors.length; i++) {
            drawCellAndNeighbors(neighbors[i], colorId);
          }
        }
      }

    };

    // centre cell
    var zoom = map.getZoom();
    var cellLevels = window.plugin.showS2Cells.cellLevel;

    for(var t = 0; cellLevels && t < cellLevels.length; t++){
        if (cellLevels[t] > zoom + 2)//Just to avoid having to many little cells on a far away zoom
            continue;
        var cell = S2.S2Cell.FromLatLng (map.getCenter(), cellLevels[t] );
        var colorId = window.plugin.showS2Cells.cellLevel.indexOf(cellLevels[t]) % 4;
        drawCellAndNeighbors(cell, colorId);
    }

    // the six cube side boundaries. we cheat by hard-coding the coords as it's simple enough
    var latLngs = [ [45,-180], [35.264389682754654,-135], [35.264389682754654,-45], [35.264389682754654,45], [35.264389682754654,135], [45,180]];

    var globalCellOptions = {color: 'red', weight: 7, opacity: 0.5, clickable: false };

    for (var i=0; i<latLngs.length-1; i++) {
      // the geodesic line code can't handle a line/polyline spanning more than (or close to?) 180 degrees, so we draw
      // each segment as a separate line
      var poly1 = L.geodesicPolyline ( [latLngs[i], latLngs[i+1]], globalCellOptions );
      window.plugin.showS2Cells.S2Layer.addLayer(poly1);

      //southern mirror of the above
      var poly2 = L.geodesicPolyline ( [[-latLngs[i][0],latLngs[i][1]], [-latLngs[i+1][0], latLngs[i+1][1]]], globalCellOptions );
      window.plugin.showS2Cells.S2Layer.addLayer(poly2);
    }

    // and the north-south lines. no need for geodesic here
    for (var j=-135; j<=135; j+=90) {
      var poly = L.polyline ( [[35.264389682754654,j], [-35.264389682754654,j]], globalCellOptions );
      window.plugin.showS2Cells.S2Layer.addLayer(poly);
    }
  }

  window.plugin.showS2Cells.drawCell = function(cell, colorId) {
    //TODO: move to function - then call for all cells on screen

    // corner points
    var corners = cell.getCornerLatLngs();

    // center point
    var center = cell.getLatLng();

    // name
//    var name = window.plugin.showS2Cells.regionName(cell);
    var color = 'red';
    switch(colorId){
        case 0: color = 'yellow';break;
        case 1: color = 'green';break;
        case 2: color = 'blue';break;
        default: color = 'red';
    }

    // the level 6 cells have noticible errors with non-geodesic lines - and the larger level 4 cells are worse
    // NOTE: we only draw two of the edges. as we draw all cells on screen, the other two edges will either be drawn
    // from the other cell, or be off screen so we don't care
    var region = L.geodesicPolyline([corners[0],corners[1],corners[2]], {fill: false, color: color, opacity: 0.5, weight: 5, clickable: false });

    window.plugin.showS2Cells.S2Layer.addLayer(region);
  };

  var setup = window.plugin.showS2Cells.setup;

  // PLUGIN END //////////////////////////////////////////////////////////


  setup.info = plugin_info; //add the script info data to the function as a property
  if(!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);
  // if IITC has already booted, immediately run the 'setup' function
  if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);
