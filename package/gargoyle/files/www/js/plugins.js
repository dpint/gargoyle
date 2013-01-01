/*
 *     Copyright (c) 2011 Cezary Jackiewicz <cezary@eko.one.pl>
 *     Copyright (c) 2012 Eric Bishop <eric@gargoyle-router.com>
 *
 *     This program is free software; you can redistribute it and/or modify
 *     it under the terms of the GNU General Public License as published by
 *     the Free Software Foundation; either version 2 of the License, or
 *     (at your option) any later version.
 *
 *     This program is distributed in the hope that it will be useful,
 *     but WITHOUT ANY WARRANTY; without even the implied warranty of
 *     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *     GNU General Public License for more details.
 *
 *     You should have received a copy of the GNU General Public License
 *     along with this program; if not, write to the Free Software
 *     Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
 *     MA 02110-1301, USA.
 */

var driveToPath = [];


function createDisplayDiv(pkgName, pkgData)
{
	var div=document.createElement('div')
	div.style.width="320px";
	div.id = pkgName;
	var elAdd=function(par, childData, isTxt, addBr)
	{
		var el;
		if(isTxt)
		{
			el = document.createElement('span');
			var lines = childData.split(/\n/);
			while(lines.length >0)
			{
				el.appendChild(document.createTextNode(lines.shift()))
				if(lines.length > 0){ el.appendChild(document.createElement('br')); }
			}		
		}
		else
		{
			el = document.createElement(childData)
		}
		par.appendChild(el);
		if(addBr){ par.appendChild(document.createElement('br')); }
		return el;
	}

	var nameDisplay = pkgData["Description"] == null ? pkgName : (pkgData["Description"])
	var statusTypes = [];
	statusTypes["not_installed"] = "Not Installed"
	statusTypes["root"] = "Pre-Installed"
	statusTypes["plugin_root"] = "Installed"
	var pkgStatus = statusTypes[ pkgData["Install-Destination"] ]


	//deliberately add 2 newlines to spearate name/description from other data
	elAdd(div, "strong", false, true)
	elAdd(div.firstChild, nameDisplay, true, true)

	elAdd(div, 'Version: ' + pkgData["Version"], true, true)
	elAdd(div, 'Status: ' + pkgStatus, true, pkgStatus == "Not Installed" ? true : false)
	if(pkgStatus == "Not Installed")
	{
		var dependsMatchUsb = false
		for (var dep in pkgData["Required-Depends"])
		{
			if(dep.match(/^kmod.*usb/))
			{
				dependsMatchUsb = true
			}
		}
		canInstall = (!dependsMatchUsb) && pkgData["Will-Fit"] == "true"
		elAdd(div, "Required Disk Space: " + parseBytes(pkgData["Required-Size"]), true, (!canInstall))
		
		if(!canInstall) 
		{
			var emEl = elAdd(div, "em", false, false)
			emEl.style.color = "#FF0000"
			if(dependsMatchUsb)
			{
				elAdd(emEl, "Package Cannot Be Installed (Requires USB support)", true, false)
			}
			else if(pkgData["Will-Fit"] == "false")
			{
				elAdd(emEl, "Package Cannot Be Installed (Insufficient Disk Space)", true, false)
			}
			pkgData["Can-Install"] = false;
		}
		else
		{
			pkgData["Can-Install"] = true;
		}
	}
	return div;
}

function updatePluginRootDisplay()
{
	var pluginRootDrive = getSelectedValue("plugin_root_drive_select");
	document.getElementById("plugin_root_static").style.display = pluginRootDrive == "root" ? "block" : "none";
	document.getElementById("plugin_root_text").style.display   = pluginRootDrive == "root" ? "none"  : "block";
}

function changePluginRoot()
{
	var textEl = document.getElementById("plugin_root_text")
	var newRootDir =  textEl.style.display != "none" ? textEl.value : "/plugin_root"
	var newRootDrive = getSelectedValue("plugin_root_drive_select")
	var oldRootDrive = uciOriginal.get("gargoyle", "plugin_options", "root_drive")
	oldRootDrive = oldRootDrive == "" ? "root" : oldRootDrive;

	var commands = [];
	var newDirPath = driveToPath[ newRootDrive ] + "/" + newRootDir
	if(oldRootDrive == "root" && newRootDrive != "root")
	{
		if(!confirm("You are switching your plugin root directory to a USB drive. This means that in order for your plugins to work correctly you must NOT remove this drive.\n\nContinue?"))
		{
			return
		}
		commands.push("mkdir -p '" + newDirPath + "'")
		commands.push("mv -f '/plugin_root/'* '" + newDirPath + "/'")
		commands.push("rm -r '/plugin_root/'")
		commands.push("ln -s '" + newDirPath + "' '/plugin_root'")

	}
	else if(oldRootDrive != "root" && newRootDrive == "root")
	{
		commands.push("mkdir -p '/plugin.root.tmp'")
		commands.push("mv -f '/plugin_root/'* '/plugin.root.tmp/'")
		commands.push("rm '/plugin_root'")
		commands.push("mv '/plugin.root.tmp' '/plugin_root'")
	}
	else if(oldRootDrive != "root" && newRootDrive != "root")
	{
		commands.push("mkdir -p '" + newDirPath + "'")
		commands.push("mv -f '/plugin_root/'* '" + newDirPath + "/'")
		commands.push("rm '/plugin_root/'")
		commands.push("ln -s '" + newDirPath + "' '/plugin_root'")
	}

	commands.push("/sbin/uci set gargoyle.plugin_options=plugin_options")
	commands.push("/sbin/uci set gargoyle.plugin_options.root_dir='" + newRootDir + "'")
	commands.push("/sbin/uci set gargoyle.plugin_options.root_drive='" + newRootDrive + "'")
	commands.push("/sbin/uci commit");
	
	execute(commands);

}

function removePluginSource()
{
	var srcName = this.parentNode.parentNode.firstChild.firstChild.data
	//alert(srcName)
	var commands = []
	commands.push("awk ' $1 != \"src/gz\" || $2 != \"" + srcName + "\"  { print $0 } ' /etc/opkg.conf >/tmp/opkg.conf.tmp")
	commands.push("mv /tmp/opkg.conf.tmp /etc/opkg.conf")
	commands.push("rm -r '/tmp/opkg-lists/" + srcName + "'")
	commands.push("opkg update")
	
	execute(commands)

}
function addPluginSource()
{
	var srcName = document.getElementById("add_source_name").value
	var srcUrl  = document.getElementById("add_source_url").value

	//NOTE: proofread to check that (1) name cannot contain a space, (2) no duplicate names (3) no duplicate URLs
}

function resetData()
{

	//set data for plugin root
	var pluginRootDir   = uciOriginal.get("gargoyle", "plugin_options", "root_dir")
	var pluginRootDrive = uciOriginal.get("gargoyle", "plugin_options", "root_drive")
	pluginRootDrive  = pluginRootDrive == "" ? "root" : pluginRootDrive;
	pluginRootDir    = pluginRootDir   == "" || pluginRootDrive == "root" ? "/plugin_root" : pluginRootDir;

	document.getElementById("plugin_root_static").style.display = pluginRootDrive == "root" ? "block" : "none";
	document.getElementById("plugin_root_text").style.display   = pluginRootDrive == "root" ? "none"  : "block";
	document.getElementById("plugin_root_drive_static").style.display = storageDrives.length == 0 ? "block" : "none";
	document.getElementById("plugin_root_drive_select").style.display = storageDrives.length == 0 ? "none"  : "block";

	
	document.getElementById("plugin_root_text").value           = pluginRootDir;
	driveToPath["Root"] = "/";
	if(storageDrives.length > 0)
	{
		var rootDriveDisplay = [];
		var rootDriveValues  = [];
		
		rootDriveDisplay.push("Root Drive " +  parseBytes(opkg_dests['root']['Bytes-Total']) + " Total, " + parseBytes(opkg_dests['root']['Bytes-Free']) + " Free")
		rootDriveValues.push("root");
		
		var driveIndex;
		for(driveIndex=0;driveIndex < storageDrives.length; driveIndex++)
		{
			rootDriveDisplay.push( storageDrives[driveIndex][0] + " " + parseBytes(storageDrives[driveIndex][4]) + " Total, " + parseBytes(storageDrives[driveIndex][5]) + " Free" )
			rootDriveValues.push( storageDrives[driveIndex][0] )
			driveToPath[ storageDrives[driveIndex][0] ] = storageDrives[driveIndex][1];
		}
		setAllowableSelections("plugin_root_drive_select", rootDriveValues, rootDriveDisplay, document);
		setSelectedValue("plugin_root_drive_select", pluginRootDrive);
		document.getElementById("plugin_root_change_container").style.display = "block"
	}
	else
	{
		setChildText("plugin_root_drive_static", "Root Drive " +  parseBytes(opkg_dests['root']['Bytes-Total']) + " Total, " + parseBytes(opkg_dests['root']['Bytes-Free']) + " Free", null, null, null, document);
		document.getElementById("plugin_root_change_container").style.display = "none"
	}


	//set data for plugin sources
	var sourceTableData = [];
	var sourceIndex;
	for(sourceIndex=0; sourceIndex < pluginSources.length; sourceIndex++)
	{
		var name = pluginSources[sourceIndex][0]
		var url  = pluginSources[sourceIndex][1]
		if( url.match(/\/\/downloads.openwrt.org/) || url.match(/\/\/www.gargoyle-router.com/))
		{
			remove = document.createElement('em');
			remove.appendChild(document.createTextNode("Preset"))
		}
		else
		{
			remove = createInput("button");
			remove.className = "default_button"
			remove.value="Remove"
			remove.onclick = removePluginSource;
		}
		sourceTableData.push( [name, url, remove] );
	}
	var sourceTable = createTable(["Name", "URL", ""], sourceTableData, "package_source_table", false, false);
	var sourceContainer = document.getElementById('package_source_table_container');
	setSingleChild(sourceContainer, sourceTable)

	
	
	
	
	
	
	//set data for plugin list
	var columnNames = ['Package', 'Installed', ''];
	var pluginsTableData = new Array();
	var pkgIndex=0;
	for(pkgIndex=0;pkgIndex < opkg_matching_packages.length; pkgIndex++)
	{
		var pkgName = opkg_matching_packages[pkgIndex];
		var pkgData = opkg_info[pkgName];
		if (pkgData != null)
		{
			
			var div=createDisplayDiv(pkgName, pkgData)

			
			var enabledCheckbox = createInput('checkbox');
			enabledCheckbox.disabled = true;
			enabledCheckbox.checked = pkgData["Install-Destination"] == 'not_installed' ? false : true;
			
			var button = createInput("button");
			button.className="default_button";
			if (enabledCheckbox.checked)
			{
				button.value = "Uninstall";
				if( pkgData["Install-Destination"] == "root" )
				{
					button.disabled = true;
					button.className = "default_button_disabled"
				}
				else
				{
					button.onclick = uninstallPackage;
				}
			}
			else
			{
				button.value = "Install";
				if( pkgData["Can-Install" ] )
				{
					button.onclick = installPackage;
				}
				else
				{
					button.disabled = true;
					button.className = "default_button_disabled"
				}
			}
			pluginsTableData.push([div, enabledCheckbox, button]);
			
		}
	}

	if (pluginsTableData.length == 0)
	{
		document.getElementById('no_packages').style.display="block";
	}
	else
	{
		pluginsTableData.sort();
		var pluginsTable = createTable(columnNames, pluginsTableData, "packages_table", false, false);
		var tableContainer = document.getElementById('packages_table_container');
		setSingleChild(tableContainer, pluginsTable)
	}
}

function installPackage()
{
	var pkg = this.parentNode.parentNode.firstChild.firstChild.id;
	var cmd = [ "sh /usr/lib/gargoyle/install_gargoyle_package.sh " + pkg  ];

	// This should be done by implementing post-inst script for a given package, not as part of package installation procedure
	//cmd.push("for i in $(opkg files " + package + " | grep \"/etc/init.d\"); do $i enable; $i start; done"); 
	
	execute(cmd);
}

function uninstallPackage()
{
	var pkg = this.parentNode.parentNode.firstChild.firstChild.id;
	var cmd = [ "sh /usr/lib/gargoyle/remove_gargoyle_package.sh " + pkg ];
	execute(cmd);
}

function updatePackagesList()
{
	var cmd = [ "opkg update" ];
	execute(cmd);
}


function execute(cmd)
{
	var commands = cmd.join("\n");
	var param = getParameterDefinition("commands", commands) + "&" + getParameterDefinition("hash", document.cookie.replace(/^.*hash=/,"").replace(/[\t ;]+.*$/, ""));
	setControlsEnabled(false, true, "Please wait...");
	
	var stateChangeFunction = function(req)
	{
		if(req.readyState == 4)
		{
			setControlsEnabled(true);
			window.location.href=window.location.href;
		}
	}
	runAjax("POST", "utility/run_commands.sh", param, stateChangeFunction);
}


