/*
Need to update weights
In the future, add POIs like Telegraph Hill, Nob Hill, Potrero Hill, Castro, schools, libraries
*/

var map,
    polylines = {},
    autocompleteOptions = [],
    streets, entities, neighborhoods, browseList,
    street, current, reticle, reticleId,
    streetName,info,
    initialZoom = 13,
    currentHash = '',
    colors = ['#2B8CBE','#F46D43'],
    theme = 'all',
    defaultOpts = {color: colors[0], opacity: 0.7},
    weights = [
        [0.5,0.5,0.5,0.5,0.5], //first level is zoom, second level is street_level
        [0.5,0.5,0.5,0.5,0.5], //1
        [0.5,0.5,0.5,0.5,0.5], //2
        [0.5,0.5,0.5,0.5,0.5], //3
        [0.5,0.5,0.5,0.5,0.5], //4
        [0.5,0.5,0.5,0.5,0.5], //5
        [0.5,0.5,0.5,0.5,0.5], //6
        [0.5,0.5,0.5,0.5,0.5], //7
        [0.5,0.5,0.5,0.5,0.5], //8
        [0.5,0.5,0.5,0.5,0.5], //9
        [0.5,0.5,0.5,0.5,0.5], //10
        [0.75,0.75,0.75,0.75,0.75], //11
        [1,1,1,1,1], //12
        [2,2,1,1,1], //13
        [3.5,3.5,2.5,2.5,2.5], //14
        [4,4,3.5,3,3], //15
        [4,4,4,4,4], //16
        [7,7,6,6,6], //17
        [10,10,8,8,8] //18
    ],
    thresholds = [
        0.004,
        0.004, //1
        0.004, //2
        0.004, //3
        0.004, //4
        0.004, //5
        0.004, //6
        0.004, //7
        0.004, //8
        0.004, //9
        0.004, //10
        0.004, //11
        0.003, //12
        0.002, //13
        0.0012, //14
        0.000425, //15
        0.0003, //16
        0.00025, //17
        0.0002 //18
    ],
    currentThreshold = thresholds[initialZoom];

    $(document).ready(function() {  

        //Initialize the map
        map = L.map('map',{
            maxBounds: [[45.7085,21.1229],[45.7904,21.3375]],
            minZoom: 12,
            maxZoom: 18,
        });                  
        resetView();

        //Background tiles (maybe switch to terrain-lines or toner)?
        L.tileLayer('http://{s}.tile.stamen.com/toner-lite/{z}/{x}/{y}.png', {
            attribution: 'Map tiles &copy; <a href="http://stamen.com">Stamen Design</a> (<a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>). Data &copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors (<a href="http://opendatacommons.org/licenses/odbl/">ODbL</a>).',
            subdomains: 'abcd'
        }).addTo(map);

        //On zoom end, resize all the polylines to match new tile zoom
        map.on('zoomend', function(e) {
            var z = map.getZoom();
            
            currentThreshold = thresholds[z];

            for (var i in polylines) {
                polylines[i].setStyle({weight: weights[z][streets[i].weight]});
            }
        });     

        map.on('click',function(e) {
            highlightClosest(e.latlng,currentThreshold,false);
        });

        //Add full screen button
        var fullScreen = new L.Control.FullScreen();
        map.addControl(fullScreen);

        //Street name hover
        streetName = L.control();
        //streetName.options.position = 'topleft';
        streetName.onAdd = function (map) {                
            this._div = L.DomUtil.create('div', 'streetName');                                
            this.update('');
            this._div.style.visibility = 'hidden';
            return this._div;
        };            
        streetName.update = function (name) {                   
            if (name.length) {
                this._div.style.visibility = 'visible';                             
            }
            this._div.innerHTML = name;                
        };
        streetName.addTo(map);


        //Info box in upper-right corner
        info = L.control();
        info.options.position = 'topright';
        info.clear = function () {
            this._div.innerHTML = '<div class="history empty"><div class="header">Vechile denumiri ale străzilor din Timișoara</div><div class="instructions"><div>Apasă pe orice stradă îngroșată pentru a afla denumirile ei vechi.</div><div>Folosește opțiunile din dreapta jos pentru a căuta o stradă anume.</div></div></div>';
        };
        info.onAdd = function (map) {                
            this._div = L.DomUtil.create('div', 'controlWhite info');
            L.DomEvent.disableClickPropagation(this._div);
            this.clear();
            return this._div;
        };    
        info.update = function (props) {  

            if (props) {
                var str = '<div class="historyOuter">' + '<div class="header">'+props.name+'</div>';
                if (props.history.length) {
                    str = str + '<div class="history">'+props.history+'</div>';
                }
                if (props.link && props.link.length) {
                    str = str + '<div class="link"><a href="'+props.link+'" class="external-link" target="_blank">Read more</a></div>';
                }


                if (props.entityIds.length) {
                    var ents = props.entityIds.split(",");                    
                    for (var i = 0; i < ents.length; i++) {
                        str = str + '<div class="entity">'
                        +'<div class="name">'+entities[ents[i]].name+'</div>'
                        + '<div class="description">'+(entities[ents[i]].image.length ? '<img src="images/'+entities[ents[i]].image+'" />' : '')+entities[ents[i]].desc+'<div class="clear"></div>';
                        if (entities[ents[i]].link.length) {                        
                            str = str + '<div class="link"><a href="'+entities[ents[i]].link+'" class="external-link" target="_blank">Read more</a></div>';
                        }
                        str = str + '</div>';
                    }
                }

                str = str + '</div>';

                this._div.innerHTML = str;
            } else {
                this.clear();
            }            

        };

        info.addTo(map);

        //Filters in lower-right corner
        var filter = L.control();
        filter.options.position = 'bottomright';
        filter.onAdd = function (map) {                
            this._div = L.DomUtil.create('div', 'controlWhite filter');
            if (navigator.geolocation) {
                $('<div id="filterLocation" class="filterRow"><label>&nbsp;</label><a href="#">Folosește locația mea</a></div>').insertAfter('#filterNeighborhoods');
            }
            var inner = $("#filterHolder").html();
            this._div.innerHTML = inner;
            $("#filterHolder").remove();        

            L.DomEvent.disableClickPropagation(this._div);
            return this._div;
        };

        filter.addTo(map);

        //Filters in lower-right corner
        var toggle = L.control();
        toggle.options.position = 'bottomleft';
        toggle.onAdd = function (map) {                
            this._div = L.DomUtil.create('div', 'controlWhite listToggle');          
            this._div.innerHTML = 'Deschide lista&nbsp;&raquo;';
            L.DomEvent.disableClickPropagation(this._div);
            return this._div;
        };

        toggle.addTo(map);        

        $("div.listToggle").click(function() {
            if ($("#alphaList").is('.opened')) {
                $("div.listToggle").html('Deschide lista&nbsp;&raquo;');                
                $("#map").removeClass("listOpen");
                $("#alphaList").hide();
                $("#alphaList").removeClass('opened');
            } else {
                $("div.listToggle").html('Închide lista&nbsp;&laquo;');
                $("#map").addClass("listOpen");
                $("#alphaList").show();
                $("#alphaList").addClass('opened');
            }
        });

		
        $("span#clearFilter").click(function() {
            $("div#filterThemes select").val('all');
            theme = 'all';
            updateTheme();
        })
		

        $("div#filterLocation a").click(function() {    
            navigator.geolocation.getCurrentPosition(processLocation,function(error){$("div#filterLocation").html("<em>O eroare împiedică găsirea locației curente.</em>");},{enableHighAccuracy: true});            
            return false;
        });    

        var streetEndings = /\s(s(t(r(e(et?)?)?)?)?|a(l(e(ea?)?)?)?|i(n(t(r(a(r(ea?)?)?)?)?)?)?|p(i(a(ta?)?)?)?|p(o(d(ul?)?)?)?|s(p(l(a(i(ul?)?)?)?)?)?|c(a(l(ea?)?)?)?|s(t(r(a(da)?)?)?)?|ct|w(ay?)?|t(e(r(r(a(ce?)?)?)?)?)?|(bulevardul)|b(l(vd?)?)?|l(a(ne?)?)?|ln|d(r(i(ve?)?)?)?|p(l(a(ce?)?)?)?|r(o(ad?)?)?|rd)$/;

        var sorter = function(a,b) {
            return a.label.toLowerCase() < b.label.toLowerCase();
        };

        $("input#search").autocomplete({            
            search: function (event,ui) {
                $(this).addClass("loading");
            },
            response: function (event,ui) {
                $(this).removeClass("loading");
            },
            source: function(request,response) {
                var priorityMatches = [];
                var otherMatches = [];
                var search = request.term.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(streetEndings,'').replace(/\s/,'');            
                var reg = new RegExp(search);
                var startsWith = new RegExp('^'+search);

                for (var id in streets) {
                    if (streets[id].name.toLowerCase().replace(/[^a-z0-9\s]/, '').replace(streetEndings,'').replace(/\s/,'').match(startsWith)) {                            
                        priorityMatches.push({"label": streets[id].name, "value": streets[id].name, "id": id});
                    } else if (streets[id].name.toLowerCase().replace(/[^a-z0-9\s]/, '').replace(streetEndings,'').replace(/\s/,'').match(reg)) {
                        otherMatches.push({"label": streets[id].name, "value": streets[id].name, "id": id});
                    }
                }

                priorityMatches.sort(sorter);
                otherMatches.sort(sorter);

                response(priorityMatches.concat(otherMatches));
            },
            select: function (event,ui) {
                window.location.hash = ui.item.id+'s';
            },
            minLength: 3
        });

		
        $("div#filterThemes select").change(function() {
            theme = $(this).val();
            updateTheme();
        });

        $("div#filterNeighborhoods select").change(function() {
            //For neighborhooods
            var hood = $("option:selected",this).text();

            var val = $(this).val();
            if (val.length) {        
                var coords = val.split(',');        
                map.fitBounds([[coords[0],coords[1]],[coords[2],coords[3]]]);                
                
                //For neighborhoods
                if (neighborhoods[hood]) {
                    info.update(neighborhoods[hood]);
                    window.location.hash = '';
                }
            }
        });
		
		
        $("div#filterToggle a").click(function() {
            $(this).parent().hide();
            $("div#filterContents").show();

            $("div.filter").addClass('widen');
            
            return false;
        });

        $("div#filterHide a").click(function() {
            $("div#filterContents").hide();
            $("div#filterToggle").show();

            $("div.filter").removeClass('widen');    

            return false;
        });
        
        $("a#aboutLink").click(function() {
            if ($("div#about:visible").length) {            
                $("div#aboutHide,div#about").hide();
            } else {
                $("div#aboutHide,div#about").show();
            }
            
            return false;
        });

        $("div#aboutHide a").click(function() {        
            $("div#aboutHide,div#about").hide();

            return false;
        });

        //for live
		queue().defer(getJSON, "data.json").defer(wait,2000).await(ready);
        //queue().defer(getJSON, "data.json?t="+ Math.floor(Math.random() * 100)).defer(wait,2000).await(ready);
    

        //for local
        //ready(null,data);
        
    });    


    /* Functions start here */

    function wait(time,callback) {
        setTimeout(function(){callback(null,time);},time);
    }        


    function getJSON(url,callback) {
		$.get(url,function(data) {
				callback(null,data);	
		},"json");
   }
    

    function ready(error,jsonData) {
		
		streets = jsonData.streets;
        entities = jsonData.entities;
        browseList = jsonData.browseList;
        neighborhoods = jsonData.neighborhoods;
        initStreets();
    }

    function initStreets() {

        //var alphaDivs = [];

        //Loop through streets, add each one to the map and to polylines object
        $.each(streets, function(id,value) {                
            
            if (value.dimensions == 3) {
                //New multipolyline
                street = new L.MultiPolyline(value.polyline,defaultOpts).setStyle({weight: weights[initialZoom][value.weight]});
            } else if (value.dimensions == 2) {
                //New single polyline
                if (value.polygon) {
                    street = new L.polygon(value.polyline,defaultOpts).setStyle({weight: weights[initialZoom][value.weight], fill: colors[0], fillOpacity: 0.4});
                } else {
                   street = new L.polyline(value.polyline,defaultOpts).setStyle({weight: weights[initialZoom][value.weight]});
                }
            }

            //alphaDivs.push({name: value.name, div: '<div class="listItem"><a id="listItem'+id+'" href="#'+id+'s">'+value.name+'</a></div>'});

            //Add it to polylines object
            polylines[id] = street;
                            
            street.on('mouseover',function(e) {
                
                //Highlight it
                this.setStyle({opacity: 1, color: colors[1]});

                streetName.update(value.name);
                $('.streetName').css('left', e.containerPoint.x).css('top', e.containerPoint.y).css('display','block');

            });

            street.on('mousemove',function(e) {
                $('.streetName').css('left', e.containerPoint.x).css('top', e.containerPoint.y);
            });

            street.on('mouseout',function(e) {
                if (this != current) {
                    //If another street is highlighted, de-highlight it
                    this.setStyle({opacity: 0.7, color: colors[0]});                    
                }
                $('.streetName').css('display','none');
            });                

            street.on('click',function(e) {
                
                //Update box with the street name
                var props = {name: value.name, history: value.history, entityIds: value.entityIds};                    
                
                info.update(props);
                window.location.hash = id;
            });                

            //add the polyline to the map
            map.addLayer(street);

        });

        //alphaDivs.sort(function(a,b) { return (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0; });

        var len = browseList.length;
        for (var i = 0; i < len; i++) {
            $("div#alphaListInner").append('<a id="listItem'+browseList[i]+'" title="'+streets[browseList[i]].name+'" href="#'+browseList[i]+'s">'+streets[browseList[i]].name+'</a>');
        }

        if (window.location.hash.match(/^#?[0-9]+$/ig)) {
            window.location.hash = window.location.hash+'s';
        } else {
            updateBrowseButtons('all',false);
        }

        checkHash();
        if ("onhashchange" in window) {
            window.onhashchange = checkHash;
        } else {
            setInterval(checkHash, 100);        
        }    

        //to drop the loading screen immediately
        $("div#loadingScreen").remove();
    }

    function checkHash() {                    
        if (window.location.hash != currentHash) {
            var zoom = false;
            
            var newHash = window.location.hash.replace(/^#/ig,'');                    
            if (newHash.match(/^[0-9]+s$/ig)) {                                                
                newHash = newHash.replace(/s/ig,'');
                zoom = true;
            }

            if (newHash == '') {
                if (current) {
                    current.setStyle({opacity: 0.7, color: colors[0]});
                }
                $("div#alphaList a").removeClass("current");

                updateBrowseButtons(theme,false);

            } else if (newHash.match(/^[0-9]+$/ig)) {
                if (reticle) {
                    map.removeLayer(reticle);
                    reticleId = 0;
                }                

                window.location.hash = newHash;

                currentHash = window.location.hash;
                if (current) {
                    current.setStyle({opacity: 0.7, color: colors[0]});
                }
                if (theme != 'all' && streets[newHash].themes.indexOf(theme) == -1) {
                    theme = 'all';
                    $("div#filterThemes select").val('all');
                    isTheme = 0;
                    updateTheme();
                }
                current = polylines[newHash];
                current.setStyle({opacity: 1, color: colors[1]});
                info.update(streets[newHash]);

                $("div#alphaList a").removeClass("current");
                $("a#listItem"+newHash).addClass("current");

                setScroll($("a#listItem"+newHash).position().top);

                updateBrowseButtons(theme,newHash);

                if (zoom) {
                    var newBounds = polylines[newHash].getBounds();
                    map.fitBounds(newBounds.pad(0.4));                    
                    newBounds = newBounds.pad(0.25);
                    reticle = L.polygon(
                        [newBounds.getNorthWest(),newBounds.getNorthEast(),newBounds.getSouthEast(),newBounds.getSouthWest()],
                        {
                            stroke: true,
                            weight: 3,
                            color: colors[1],
                            opacity: 0.7,
                            fill: false,
                            dashArray: "2,6",
                            clickable: false
                        }
                    );                    
                    reticleId = newHash;
                    map.addLayer(reticle);                    
                    $(reticle._container).delay(1500).fadeOut(1200,function() {
                        if (reticle && reticleId == newHash) {
                            map.removeLayer(reticle);
                        }
                    });
                }                        
            }
        }     
    }

    function setScroll(topPos) {
        var topScroll = $("#alphaListInner").scrollTop();             
        var scrollHeight = $(window).height() - ($("div#filtering:visible").length ? $("div#filtering").height() : 0);

        if (topPos < 0) {
            $("div#alphaListInner").scrollTop(Math.max(0,topScroll + topPos)-(scrollHeight/2));
        } else if (topPos > scrollHeight) {
            $("div#alphaListInner").scrollTop(topScroll+topPos-(scrollHeight/2));
        }
    }

    function getMinDistance(point,layer) {                
        var minDistance;

        if (layer[0].length) {                    
            //it's an array of polylines, get the mindistance for each
            minDistance = Infinity;

            var len = layer.length;
            for (var i = 0; i < len; i++) {   
                minDistance = Math.min(minDistance,getMinDistanceToSegment(point,layer[i]));
            }
        } else {                    
            minDistance = getMinDistanceToSegment(point,layer);
        }

        return minDistance;
    }

    function getMinDistanceToSegment(point,polyline) {
            var minDistance = Infinity;
            
            //go through the points
            var len = polyline.length;
            
            for (var i = 0; i < len-1; i++) {

                minDistance = Math.min(minDistance,minDistanceToSegment(point,polyline[i],polyline[i+1]));

            }
            
            return minDistance;
    }

    // return closest point on segment or distance to that point
    function minDistanceToSegment(p, p1, p2) {
        var x = p1.lat,
            y = p1.lng,
            dx = p2.lat - x,
            dy = p2.lng - y,
            dot = dx * dx + dy * dy,
            t;

        if (dot > 0) {
            t = ((p.lat - x) * dx + (p.lng - y) * dy) / dot;

            if (t > 1) {
                x = p2.lat;
                y = p2.lng;
            } else if (t > 0) {
                x += dx * t;
                y += dy * t;
            }
        }

        dx = p.lat - x;
        dy = p.lng - y;

        return Math.sqrt(dx * dx + dy * dy);
    }            

    function highlightClosest(latlng,threshold,forceZoom) {
        var dist,closestStreet,minDistance = Infinity;

        for (var i in streets) {

            if (theme == 'all' || streets[i].themes.indexOf(theme) != -1) {

                dist = getMinDistance(latlng,streets[i].polyline);
            
                if (dist < minDistance) {                
                    closestStreet = i;
                    minDistance = dist;
                    
                    //it's really close, don't check them all
                    if (dist < threshold/2) break;
                }
            
            }            
        }

        if (minDistance < threshold) {
            window.location.hash = closestStreet+(forceZoom ? 's' : '');
        }

    }

    function updateTheme() {
        var bounds = map.getBounds(), numViewable = 0;

                    
        $("div#alphaList a").removeClass('notTheme');
        if (theme == 'all') {
            $("div#filtering").hide();
            $("div#alphaListInner").addClass("allStreets");
        } else {
            $("div#filtering").show();
            $("span#filterCurrent").html(theme);
            $("div#alphaListInner").removeClass("allStreets");
        }


        for (var i in polylines) {                    
            if (polylines[i] == current) {
                if (theme == 'all' || streets[i].themes.indexOf(theme) != -1) {
                    polylines[i].setStyle({color: colors[1]});
                    if (bounds.intersects(polylines[i].getBounds())) numViewable++;
                } else {
                    map.removeLayer(polylines[i]);
                    info.clear();
                    window.location.hash = '';
                    $("a#listItem"+i).removeClass('current').addClass('notTheme');
                }
            } else {
                if (theme == 'all' || streets[i].themes.indexOf(theme) != -1) {
                    polylines[i].setStyle({color: colors[0]});
                    map.addLayer(polylines[i]);
                    
                    if (bounds.intersects(polylines[i].getBounds())) numViewable++;
                } else {
                    map.removeLayer(polylines[i]);
                    $("a#listItem"+i).addClass('notTheme');
                }
            }

        }

        setScroll($("div#alphaListInner a:not(.notTheme)").first().position().top);

        if (numViewable < 3) resetView();

        updateBrowseButtons(theme,((window.location.hash.replace(/^#/ig,'').length) ? window.location.hash.replace(/^#/ig,'') : false));
    }

    function resetView() {
        //map.setView([37.779372, -122.44576], initialZoom);

        //Fit bounds instead of manually setting a view, more responsive that way
        map.fitBounds([[45.7085,21.1229],[45.7904,21.3375]]);
    }

    function updateBrowseButtons (theme,id) {
        if (id) {

            var afterAll = $("a#listItem"+id).nextAll('a:not(.notTheme)');
            if (afterAll.length) {
                var after = afterAll.first().attr('href');    
            } else {
                var after = $("div#alphaList a:not(.notTheme)").first().attr('href');    
            }

            var beforeAll = $("a#listItem"+id).prevAll('a:not(.notTheme)');
            if (beforeAll.length) {
                var before = beforeAll.first().attr('href');    
            } else {
                var before = $("div#alphaList a:not(.notTheme)").last().attr('href');    
            }
            
        } else {
            var before = $("div#alphaList a:not(.notTheme)").last().attr('href');
            var after = $("div#alphaList a:not(.notTheme)").first().attr('href');
        }

        $("a#browseBefore").attr("href",before);
        $("a#browseAfter").attr("href",after);
    }   

    function processLocation(loc) {
        var z = 15;

        if (loc.coords.longitude >= -122.526 && loc.coords.longitude <= -122.350 && loc.coords.latitude >= 37.691 && loc.coords.latitude <= 37.821) {
            if (loc.coords.accuracy) {
                if (loc.coords.accuracy < 30) {
                    z = 18;
                } else if (loc.coords.accuracy < 200) {
                    z = 17;
                } else if (loc.coords.accuracy < 400) {
                    z = 16;
                }
            }            

            map.setView([loc.coords.latitude,loc.coords.longitude], z);
            
            highlightClosest({lat: loc.coords.latitude, lng: loc.coords.longitude}, 0.1, true);

        } else {
            $("div#filterLocation").html("<em>Nu pari să fii in Timisoara.</em>");
        }
        
    }