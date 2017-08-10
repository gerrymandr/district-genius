// Array map polyfill
if (!Array.prototype.map) {
  Array.prototype.map = function(callback/*, thisArg*/) {
    var T, A, k;
    if (this == null) {
      throw new TypeError('this is null or not defined');
    }
    var O = Object(this);
    var len = O.length >>> 0;
    if (typeof callback !== 'function') {
      throw new TypeError(callback + ' is not a function');
    }
    if (arguments.length > 1) {
      T = arguments[1];
    }
    A = new Array(len);
    k = 0;
    while (k < len) {
      var kValue, mappedValue;
      if (k in O) {
        kValue = O[k];
        mappedValue = callback.call(T, kValue, k, O);
        A[k] = mappedValue;
      }
      k++;
    }
    return A;
  };
}

$(function() {
  var highlight;

  var map = L.map('map', {
      drawControl: true
    })
    .setView([39.9603624, -75.2717938], 13);
  map.attributionControl.setPrefix('');

  // Humanitarian OSM layer?
  L.tileLayer('//tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // hard-coded one GeoJSON district
  var district_lines = [];
  $.getJSON('/geojson/pa-1.geojson', function(data) {
    var coordinates = data.geometry.coordinates;
    var bounds = makeBounds(coordinates);
    map.fitBounds(L.latLngBounds([[bounds[1], bounds[0]], [bounds[3], bounds[2]]]));

    // a district might be a Polygon or MultiPolygon
    // there are no holes in districts (I think?) so we should only be worried about one outer ring of the Polygon
    // we are rendering the district as a LineString so that we can do the TurfJS clip thing

    function addBorderSegment(ptlist) {
      L.polyline(ptlist.map(function(coordinate) {
        return coordinate.reverse();
      }), {
        color: 'purple'
      }).addTo(map);

      var ptlist = [].concat(ptlist).map(function(coordinate) {
        return coordinate.reverse();
      });
      district_lines.push(turf.lineString(ptlist));
    }

    if (data.geometry.type === 'MultiPolygon') {
      // multiple polygon areas
      data.geometry.coordinates.map(function (polygon) {
        addBorderSegment(polygon[0]);
      });
    } else {
      // regular polygon -> polyline
      addBorderSegment(data.geometry.coordinates[0]);
    }

    // add the comments over the border
    comments.map(function (comment) {
      L.geoJson(comment.geo, {
          style: function(feature) {
            return { weight: 8, color: 'red' };
          }
        })
        .bindPopup(textOfComment(comment))
        .addTo(map);
    });
  });

  // Leaflet Draw toolbar
  map.on(L.Draw.Event.CREATED, function (e) {
    // console.log(e.layer);
    var clip;
    for (var i = 0; i < district_lines.length; i++) {
      var district_line = district_lines[i];
      if (e.layer.options.radius) {
        clip = turf.intersect(district_line, circle);
        console.log('circle at ' + e.layer.getLatLng() + ' with radius ' + e.layer.options.radius);
        throw 'not yet supported in clip';
      } else {
        var west = e.layer.getBounds().getSouthWest().lng;
        var south = e.layer.getBounds().getSouthWest().lat;
        var east = e.layer.getBounds().getNorthEast().lng;
        var north = e.layer.getBounds().getNorthEast().lat;

        clip = turf.bboxClip(district_line, [west, south, east, north]);
        console.log('rectangle with bounds ' + e.layer.getBounds());
      }
      if (clip) {
        if (highlight) {
          map.removeLayer(highlight);
        }
        highlight = L.geoJson(clip, {
          style: function(feature) {
            return { color: 'blue', weight: 8 };
          }
        }).addTo(map)
        .bindPopup(generatePopup(clip))
        .openPopup();

        // only one intersect needed?
        // break;
      }
    }
  });
});

function generatePopup(district_geo) {
  // very basic code for making a comment type thing
  var outer = $('<div>');
  var blurb = $('<form>')
    .attr('class', 'comment-form')
    .attr('method', 'POST')
    .attr('action', '/comment');
  blurb.append($('<input>')
    .attr('type', 'hidden')
    .attr('name', '_csrf')
    .val($('#csrf').val())
  );
  blurb.append($('<input>')
    .attr('type', 'hidden')
    .attr('name', 'user_id')
    .attr('value', $('#user_id').val()));
  blurb.append($('<input>')
    .attr('type', 'hidden')
    .attr('name', 'district')
    .val(JSON.stringify(district_geo.geometry))
  );
  blurb.append($('<h4>').text('Make a Comment'));
  blurb.append($('<textarea>')
    .attr('class', 'form-control')
    .attr('name', 'text')
    .attr('rows', 4)
  );
  blurb.append($('<input>')
    .attr('class', 'btn btn-primary')
    .attr('type', 'submit')
    .val('Post')
  );
  outer.append(blurb);
  return outer.html();
}

function makeBounds(coordinates, existing) {
  if (!existing) {
    existing = [180, 90, -180, -90];
  }
  if (typeof coordinates[0] === 'number') {
    existing[0] = Math.min(existing[0], coordinates[0]);
    existing[1] = Math.min(existing[1], coordinates[1]);
    existing[2] = Math.max(existing[2], coordinates[0]);
    existing[3] = Math.max(existing[3], coordinates[1]);
  } else {
    for (var c = 0; c < coordinates.length; c++) {
      existing = makeBounds(coordinates[c], existing);
    }
  }
  return existing;
}

function textOfComment(comment) {
  return comment.text + '<br/>by <strong>' + comment.user + '</strong>';
}