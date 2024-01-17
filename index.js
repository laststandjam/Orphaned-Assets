
var items = [];
var items_wmc = [];
var items_final = [];
var orphaned = false;
var lang = "";
var langids = [];
var project = "";
var key = "";


let basePath = ""
const targetTypes = new Set()
const targetElements = []
const variantResponse = []


// targets = [{type:}]

$(document).ready(function () {

	//Set variables from form
	$("#submit").click(function () {

		items = [];
		items_wmc = [];
		items_final = [];
		lang = $("#lang").val();
		project = $("#project").val();
		basePath = 'https://manage.kontent.ai/v2/projects/' + project
		key = $("#prev").val();
		langids = [];
		orphaned = $("#orphaned").is(':checked');
		$("#tables").html("");
		$("#msg").html("");
		loadTypes();
		$('.overlay').show();

	});

	//delete Assets Confirmation
	$("#confirmationButton").click(function(){
		deleteOrpahnedAssets()
	})

	//canel delete Assets
	$("#cancelButton").click(function(){
		$(".deletionOverlay").hide()
	})


});



//get types we need to check for assets
function loadTypes() {
	$.ajax({
		url: basePath + "/types",
		dataType: 'text',
		beforeSend: function (xhr, settings) {
			if (key) {
				xhr.setRequestHeader('Authorization', 'Bearer ' + key);
			}
		},
		success: function (data, textStatus, request) {
			data = JSON.parse(data);
			if (data.types.length > 0) {
				for (var x = 0; x < data.types.length; x++) {
					let currentType = data.types[x];

					for (let i = 0; i < currentType.elements.length; i++) {
						let currentElement = currentType.elements[i];

						if (currentElement.type === "asset" || currentElement.type === "rich_text") {
							let hit = {
								typeID: currentType.id,
								elements: [{
									elementID: currentElement.id,
									elementType: currentElement.type
								}]
							};

							let obj = targetElements.find(obj => obj.typeID === hit.typeID);
							if (obj) {
								// Check if an element with the same elementID already exists
								let elemObj = obj.elements.find(elem => elem.elementID === hit.elements[0].elementID);
								if (!elemObj) {
									obj.elements.push(hit.elements[0]);
								}
							} else {
								targetTypes.add(currentType.id);
								targetElements.push(hit);
							}
						}
					}
				}
				
				loadItemVariants();
			}
		}
	});
}



const loadItemVariants = async () => {
	const reqTypes = [...targetTypes];
	let continuationToken = null;
	let retryCount = 0;
	const allVariants = [];
	const maxRetryAttempts = 3;
	const retryDelay = 6000000;
  
	console.log(reqTypes);
  
	const handleRequest = async (req) => {
	  try {
		const response = await $.ajax({
		  url: `${basePath}/types/${req}/variants`,
		  dataType: 'json',
		  beforeSend: function (xhr, settings) {
			if (key) {
			  xhr.setRequestHeader('Authorization', `Bearer ${key}`);
			}
			if (continuationToken) {
			  xhr.setRequestHeader('X-Continuation', continuationToken);
			}
		  },
		});
  
		console.log(response);
		const { variants, pagination } = response;
  
		allVariants.push({ type: req, variants });
  
		if (pagination && pagination.continuation_token) {
		  continuationToken = pagination.continuation_token;
		  // Make the subsequent request here and await it
		  await handleRequest(req);
		} else {
		  continuationToken = null; // Reset continuationToken when there's no more token
		  return false;
		}
	  } catch (error) {
		if (error.status === 429 && retryCount < maxRetryAttempts) {
		  console.log(`Retrying request for ${req}, Retry count: ${retryCount}`);
		  const waitTime = Math.pow(2, retryCount) * retryDelay;
		  await new Promise((resolve) => setTimeout(resolve, waitTime));
		  retryCount++;
		  // Retry the request
		  return await handleRequest(req);
		} else {
		  throw error;
		}
	  }
	};
  
	try {
	  // Start the recursive request handling for all reqTypes
	  for (const req of reqTypes) {
		await handleRequest(req);
	  }
  
	  // After all requests are completed, call processVariants once with all variants
	  processVariants(allVariants);
	} catch (error) {
	  console.error('Error in loadItemVariants:', error);
	  $('#msg').html(
		'An error occurred. Please check the console for details.'
	  );
	  $('.overlay').hide();
	}
  };
  
  
 

function processVariants(data) {
	console.log('processVariants hit')
	console.log('data', data)
	targetElements.forEach(targetType => {



		targetType.elements.forEach(targetElement => {
			console.log("ele", targetElement)
			const match = data.find(responseType => responseType.type === targetType.typeID)

			match.variants.forEach(responseVariant => {
				const found = responseVariant.elements.find(responseElement => responseElement.element.id === targetElement.elementID)


				// if target element is an array push the asset id 
				//note will need to add another loop to create an assetItem for mutiple assets
				if (targetElement.elementType === 'asset') {

					found.value.forEach(asset => {
						const assetItem = {
							itemID: responseVariant.item.id,
							assetValue: asset.id,
							langID: responseVariant.language.id,
							itemURL: `https://app.kontent.ai/${project}/content-inventory/${responseVariant.language.id}/content/${responseVariant.item.id}`
						}
						items.push(assetItem)
					})

				} else if (targetElement.elementType === 'rich_text' && found.value.includes('data-asset-id')) {
					console.log("wath this", found)
					console.log(responseVariant.item.id)
					const regex = /\"(.*?)\"/
					const assetItem = {
						itemID: responseVariant.item.id,
						assetValue: regex.exec(found.value)[1],
						langID: responseVariant.language.id,
						itemURL: `https://app.kontent.ai/${project}/content-inventory/${responseVariant.language.id}/content/${responseVariant.item.id}`

					}
					regex.exec(found.value)
					items.push(assetItem)

				} else if (targetElement.elementType === 'rich_text' && found.components.length > 0) {
					console.log('component hit', found)



					found.components.forEach(component => {
						//figure out what Item Type the Component is 
						console.log(targetElements)
						const componentType = targetElements.find(targetElement => targetElement.typeID === component.type.id)
						console.log(targetElement)
						console.log("componet type", componentType, component.type.id)

						if(componentType){
						component.elements.forEach(element => {
							const componentElement = componentType.elements.find(targetElement => element.element.id === targetElement.elementID)
							
							
							if(componentElement){
								console.log("check out this element type", componentElement)
							if (componentElement.elementType === "rich_text" && found.value.includes('data-asset-id')) {
								const regex = /\"(.*?)\"/
								const assetItem = {
									itemID: responseVariant.item.id,
									assetValue: regex.exec(found.value)[1],
									langID: responseVariant.language.id,
									itemURL: `https://app.kontent.ai/${project}/content-inventory/${responseVariant.language.id}/content/${responseVariant.item.id}`

								}
								regex.exec(found.value)
								items.push(assetItem)
							} else if (componentElement.elementType=== "asset") {
								console.log('hit component asset', element)
								element.value.forEach(asset=>{
									const assetItem = {
									itemID: responseVariant.item.id,
									assetValue: asset.id,
									langID: responseVariant.language.id,
									itemURL: `https://app.kontent.ai/${project}/content-inventory/${responseVariant.language.id}/content/${responseVariant.item.id}`
								}
									console.log(assetItem)
								items.push(assetItem)
								})
								
							
							}}
						})}


					})
					



				}


			})
		})



	})
	loadAssets()
	// buildTable()
}

const loadAssets = (xc, retryCount = 0, allAssets = []) => {
	const url = basePath + "/assets";
	const maxRetryAttempts = 3;
	const retryDelay = 3000000; // 6 seconds
	
  
	$.ajax({
	  url: url,
	  dataType: 'text',
	  beforeSend: function (xhr, settings) {
		if (xc) {
		  xhr.setRequestHeader('X-Continuation', xc);
		}
		if (key) {
		  xhr.setRequestHeader('Authorization', 'Bearer ' + key);
		}
	  },
	  success: function (data, textStatus, request) {
		console.log (data)
		data = JSON.parse(data);
  
		if (data.assets.length>0) {

		  if (data.pagination.continuation_token) {
			// Make the subsequent request here and pass the continuation token
			allAssets.push(...data.assets)
			let newXC=data.pagination.continuation_token
			loadAssets(newXC, 0, allAssets);
		  } else {
			allAssets.push(...data.assets)
			processAssets(allAssets);
		  }
		} else {
		  console.log("No Assets found");
		  $("#msg").html("No Assets found.");
		  $('.overlay').hide();
		}
	  },
	  error: function (jqXHR, textStatus, errorThrown) {
		if (jqXHR.status === 429 && retryCount < maxRetryAttempts) {
		  console.log(`Retrying request for assets, Retry count: ${retryCount}`);
		  const waitTime = Math.pow(2, retryCount) * retryDelay;
		  setTimeout(() => {
			// Retry the request with an increased retry count
			loadAssets(xc, retryCount + 1);
		  }, waitTime);
		} else {
		  $("#msg").html("No data found. Please make sure you have the correct project id and Managment API Key");
		  $('.overlay').hide();
		}
	  }
	});
  };
  
  

const processAssets = (assets) => {
	console.log(assets)
	const results = assets.forEach(asset => {
		const item = items.find(item => item.assetValue === asset.id);

		if (item) {
			// Add the value from asset to the matching item in items
			item.assetName = asset.file_name // Replace "value" with the appropriate property name in the asset object
			item.assetURL = `https://kontent.ai/${project}/content-inventory/assets/asset/${asset.id}`
		} else {

			items.push({
				assetValue: asset.id,
				assetName: asset.file_name,
				itemURL: "N/A",
				itemID: "N/A"
			})
		}


	});

	buildTable()
}

const buildTable = () => {


	const table = document.createElement('table');
	const tableHeader = table.createTHead();
	const tableBody = table.createTBody();
	const headers = ['Asset Name', 'Item ID', 'Item URL'];

	const headerRow = tableHeader.insertRow();
	headers.forEach(header => {
		const th = document.createElement('th');
		th.textContent = header;
		headerRow.appendChild(th);
	});

	//check if oprhaned box is check and remove non orphaned values
	if(orphaned){
		items=items.filter(item=> item.itemURL==="N/A")
	}
	console.log(items                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      )
	items.forEach(rowData => {
		const row = tableBody.insertRow();
		const { itemID, assetName, itemURL } = rowData;
		[assetName, itemID, itemURL].forEach(value => {

			if(value===itemURL){
				const cell = row.insertCell()
				cell.innerHTML=`<a href=${value}> ${value}</a>`
			}else{
			const cell = row.insertCell();
			cell.textContent = value;
			}
		});
	});
	$("#tables").append(table);
	$('.overlay').hide();

	orphanCheck =items.find(item=>item.itemURL === "N/A")
	console.log(orphanCheck)
	if(orphanCheck){
	const deleteButton = $('<button/>').text("Delete Assets").on("click", function(){
	$(".deletionOverlay").show()
	}).prop({id:"deleteButton"});
	$("#deleteButtonContainer").append(deleteButton)
	}
}


const deleteOrpahnedAssets = ()=> {

	console.log('hit me ')
	orphanedAssets = items.filter(item=> item.itemURL==="N/A")
	var url = basePath + "/assets"

	orphanedAssets.forEach(asset=>
		
		$.ajax({
			url:url+`/${asset.assetValue}`,
			dataType: "Text",
			type:'DELETE',
			beforeSend: function(xhr)
			{ if (key) {
				xhr.setRequestHeader('Authorization', 'Bearer ' + key);}
			},success: function (data, textStatus, request) {

				console.log(asset.value, "deleted")
			}

		}))
		$(".deletionOverlay").hide()
		$("#deleteButton").remove()


}

function processItems(data) {
	for (var x = 0; x < data.length; x++) {
		for (const key in data[x].elements) {
			if (data[x].elements[key].type == "modular_content") {
				for (var y = 0; y < data[x].elements[key].value.length; y++) {
					items_wmc.push([data[x].system.codename, data[x].system.name, data[x].system.id, data[x].elements[key].value[y], data[x].system.language]);
				}
			}
			if (data[x].elements[key].type == "rich_text") {
				for (var y = 0; y < data[x].elements[key].modular_content.length; y++) {
					items_wmc.push([data[x].system.codename, data[x].system.name, data[x].system.id, data[x].elements[key].modular_content[y], data[x].system.language]);
				}
			}
		}
		items.push([data[x].system.codename, data[x].system.name, data[x].system.id, data[x].system.language]);
	}

}

function countItems() {
	if (orphaned) {
		for (var x = 0; x < items.length; x++) {
			var isUsed = false;
			for (var y = 0; y < items_wmc.length; y++) {
				if (items[x][0] == items_wmc[y][3]) {
					isUsed = true;
				}
			}
			if (!isUsed) {
				items_final.push([returnLink(items[x][1], items[x][2]), items[x][0], "not used anywhere"]);
			}
		}
	}
	else {
		for (var x = 0; x < items.length; x++) {
			var isUsed = false;
			var usedIn = [];
			for (var y = 0; y < items_wmc.length; y++) {
				if (items[x][0] == items_wmc[y][3]) {
					isUsed = true;
					usedIn.push(returnLink(items_wmc[y][1], items_wmc[y][2], items_wmc[y][4]));
				}
			}
			if (!isUsed) {
				items_final.push([returnLink(items[x][1], items[x][2], items[x][3]), items[x][0], "not used anywhere"]);
			}
			else {
				items_final.push([returnLink(items[x][1], items[x][2], items[x][3]), items[x][0], usedIn.join(", ")]);
			}
		}
	}
	buildData(0);
}