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

var highlight, map;

$(function() {
  map = L.map('map', {
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
  $.getJSON('/2016-congressional-districts/' + state.toUpperCase() + '-' + dnum + '/shape.geojson', function(data) {
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
    district_lines.map(function(district_line) {
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
      }

      if (clip.geometry.coordinates.length) {
        // overlapped the border

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
    });
  });
});

var comment_geo;
function generatePopup(district_geo) {
  // very basic code for making a comment type thing

  /*
  if (!($('#user_id').val())) {
    return 'Please <a href="/login">log in</a> to make a comment...';
  }
  */

  comment_geo = district_geo.geometry;

  var blurb = $('<div>')
    .attr('class', 'comment-form');
  blurb.append($('<h4>').text('Make a Comment'));
  blurb.append($('<textarea>')
    .attr('class', 'form-control my-comment')
    .attr('name', 'text')
    .attr('rows', 4)
  );
  blurb.append($('<button>')
    .attr('class', 'btn btn-primary pull-right')
    .text('Post')
    .attr('onclick', 'submitCommentForm()')
  );
  blurb.append($('<div>')
    .attr('class', 'clearfix')
  );
  var outer = $('<div>');
  outer.append(blurb);
  return outer.html();
}

function submitCommentForm() {
  $('.comment-form button').attr('disabled', 'disabled');
  var origText = $('textarea.my-comment').val();
  return $.post('/comment', {
    _csrf: $('#csrf').val(),
    user_id: $('#user_id').val(),
    mapID: $('#mapID').val(),
    district: JSON.stringify(comment_geo),
    text: origText
  }, function (response) {
    highlight.closePopup();
    highlight.unbindPopup();
    highlight.bindPopup('<strong>You made this comment:</strong><br/>' + origText);
  });
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
