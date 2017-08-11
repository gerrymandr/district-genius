# district-genius

A work-in-progress at the Metric Geometry and Gerrymandering Group (MGGG)

Annotate parts of a district to show what neighborhoods are in and out

Find out if your district might be gerrymandered

You can look up any district with this URL format: https://district-genius.herokuapp.com/map/HI-1

For single-district states (?) https://district-genius.herokuapp.com/map/WY-0

## Overview

Here are your district boundaries

<img src="http://i.imgur.com/9tRLm0B.jpg" width="400"/>

This part of your district boundary is particularly interesting.  Why are these blocks in and other blocks out?

Click this line to read a comment (hoping to recruit some expert comments on these!)

<img src="http://i.imgur.com/qEYakp1.jpg" width="400"/>

Select another part of a district border, and make your own question or comment.

<img src="http://i.imgur.com/xjSkAFJ.png" width="400"/>


## Database schema

A User must be logged in to leave a Comment.

A Comment contains geo, text, and author information for a message left by a User.

A Map is created for each group of comments (for example, we have a Map for each district,
  and could add a Map for each organization which is interested in working on a district)

## Using these Libraries

* <a href="https://leafletjs.com">LeafletJS</a>
* <a href="https://github.com/Leaflet/Leaflet.draw">Leaflet.draw</a>
* <a href="https://github.com/Leaflet/Leaflet.heat">Leaflet-heat</a> for heatmap (currently adding at 2D centroid of a LineString, would like to have 1D midpoint of the line instead)
* jQuery and Bootstrap (but we could still switch to Angular or React)

## License

Open source, MIT license
