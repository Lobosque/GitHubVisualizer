    // This will parse a delimited string into an array of
    // arrays. The default delimiter is the comma, but this
    // can be overriden in the second argument.
    function CSVToArray( strData, strDelimiter ){
    	// Check to see if the delimiter is defined. If not,
    	// then default to comma.
    	strDelimiter = (strDelimiter || ",");

    	// Create a regular expression to parse the CSV values.
    	var objPattern = new RegExp(
    		(
    			// Delimiters.
    			"(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +

    			// Quoted fields.
    			"(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

    			// Standard fields.
    			"([^\"\\" + strDelimiter + "\\r\\n]*))"
    		),
    		"gi"
    		);


    	// Create an array to hold our data. Give the array
    	// a default empty first row.
    	var arrData = [[]];

    	// Create an array to hold our individual pattern
    	// matching groups.
    	var arrMatches = null;


    	// Keep looping over the regular expression matches
    	// until we can no longer find a match.
    	while (arrMatches = objPattern.exec( strData )){

    		// Get the delimiter that was found.
    		var strMatchedDelimiter = arrMatches[ 1 ];

    		// Check to see if the given delimiter has a length
    		// (is not the start of string) and if it matches
    		// field delimiter. If id does not, then we know
    		// that this delimiter is a row delimiter.
    		if (
    			strMatchedDelimiter.length &&
    			(strMatchedDelimiter != strDelimiter)
    			){

    			// Since we have reached a new row of data,
    			// add an empty row to our data array.
    			arrData.push( [] );

    		}


    		// Now that we have our delimiter out of the way,
    		// let's check to see which kind of value we
    		// captured (quoted or unquoted).
    		if (arrMatches[ 2 ]){

    			// We found a quoted value. When we capture
    			// this value, unescape any double quotes.
    			var strMatchedValue = arrMatches[ 2 ].replace(
    				new RegExp( "\"\"", "g" ),
    				"\""
    				);

    		} else {

    			// We found a non-quoted value.
    			var strMatchedValue = arrMatches[ 3 ];

    		}


    		// Now that we have our value string, let's add
    		// it to the data array.
    		arrData[ arrData.length - 1 ].push( strMatchedValue );
    	}

    	// Return the parsed data.
    	return( arrData );
    }


if(!Array.prototype.indexOf) {
    Array.prototype.indexOf = function(needle) {
        for(var i = 0; i < this.length; i++) {
            if(this[i] === needle) {
                return i;
            }
        }
        return -1;
    };
}

var dateToTimestamp = function(dateStr) {
  var dateArr = dateStr.split('/');
  var dd = dateArr[0];
  var mm = dateArr[1];
  var yyyy = '20'+dateArr[2];

  dd = parseInt(dd);
  if(dd < 10){ 
    dd = '0' +dd;
  }
 mm = parseInt(mm);
  if(mm < 10){
      mm = '0' + mm;
  }
  console.log(yyyy+'-'+mm+'-'+dd);
  var date = new Date(yyyy+'-'+mm+'-'+dd).getTime();
  return date;
}
var csvParser = CSVToArray(csvData);

var sales = [];
var dates = [];

var parseStuff = function() {
for(var i = 0; i < csvParser.length; i++) {
  var obj = {
    id: parseInt(csvParser[i][0]),
    date: dateToTimestamp(csvParser[i][1]),
    name: csvParser[i][2],
    amount: csvParser[i][3],
    avatar_url: csvParser[i][4]
  }
  if(dates.indexOf(obj.date) == -1) {
    dates.push(obj.date);
  }
  sales.push({
    id: obj.id,
    author: {
      name: obj.name,
      avatar_url: obj.avatar_url,
    },
    sale: {
      id: obj.id,
      amount: obj.amount
    },
    date: obj.date
  });
}

 return {
  sales: sales,
  dates: dates
};
}
