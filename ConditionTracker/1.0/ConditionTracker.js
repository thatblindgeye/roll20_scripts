/**
 * ConditionTracker
 *
 * Version 1.0
 * Last updated: July 17, 2022
 * Author: Eric Olkowski (thatblindgeye)
 *
 * Command syntax:
 * !ct --<keyword>|<optional modifier>|<options>
 *
 */

var ConditionTracker =
  ConditionTracker ||
  (function () {
    "use strict";

    const VERSION = "1.0";
    const LAST_UPDATED = 1658014518056;
    const COMMANDS_LIST = {
      help: {
        keyword: "--help",
        description:
          "Sends to chat a tabl of valid ConditionTracker commands and their descriptions.",
        modifiers: {},
      },
      campaignMarkers: {
        keyword: "--campaignmarkers",
        description:
          "Sends to chat a table of token markers currently available in the campaign, excluding the default Roll20 color and death markers. The table includes the marker image and name.",
        modifiers: {},
      },
      addCondition: {
        keyword: "--addcondition",
        description:
          "Cumulatively adds the specified condition(s) to the selected token(s). Useful if multiple instances of a condition/status has a different meaning than a single instance. By default the condition name will be added to the token tooltip, and if a valid marker name is linked to the condition a maker will be applied. <br/><br/> Proper syntax is <code>!ct --addcondition|&#60;comma separated list of conditions&#62;</code>, e.g. <code>!ct --addcondition|blinded, deafened</code>.",
        modifiers: {},
      },
      removeCondition: {
        keyword: "--removecondition",
        description:
          "Removes the specified condition(s) from the selected token(s). By default all instances of the specified condition(s) will be removed. <br/><br/> Proper syntax is <code>!ct --removecondition|&#60;comma separated list of conditions&#62;</code>, e.g. <code>!ct --removecondition|blinded, deafened</code>.",
        modifiers: [
          {
            keyword: "single",
            description:
              "Only one instance of the specified condition(s) will be removed from the token.",
          },
        ],
      },
    };
    const DEFAULT_STATE = {
      version: "1.0",
      /**
       * A list of conditions/statuses that can be applied to a token, including descriptions of their effects.
       * Conditions that are passed in will be applied to a token's tooltip.
       *
       * By default a marker will only be added to a token if the condition/status passed in has a valid
       * markerName that matches a token marker name for the campaign. A markerName can be added to each
       * condition object.
       *
       * Uses D&D 5e conditions as a default, but can be customized.
       */
      conditions: [
        {
          conditionName: "blinded",
          markerName: null,
          effects: [
            "A blinded creature can't see and automatically fails any ability check that requires sight.",
            "Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage.",
          ],
        },
        {
          conditionName: "charmed",
          markerName: "skull",
          effects: [
            "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects.",
            "The charmer has advantage on any ability check to interact socially with the creature..",
          ],
        },
      ],
    };

    function checkInstall() {
      if (!_.has(state, "ConditionTracker")) {
        log("Installing ConditionTracker Version " + VERSION);
        state.ConditionTracker = DEFAULT_STATE;
      } else if (state.ConditionTracker.version !== VERSION) {
        log("Updating to ConditionTracker Version " + VERSION);
        /**
         * Update the current version installed without overwriting any customizations
         * made by the user.
         */
        state.ConditionTracker = _.extend(
          {},
          DEFAULT_STATE,
          state.ConditionTracker
        );
        state.ConditionTracker.version = VERSION;
      }

      log(
        "ConditionTracker Version " +
          VERSION +
          " installed. Last updated " +
          new Date(LAST_UPDATED).toLocaleString()
      );
    }

    let campaignMarkers;
    function fetchCampaignMarkers() {
      const fetchedMarkers = JSON.parse(Campaign().get("token_markers"));
      campaignMarkers = _.sortBy(fetchedMarkers, "name");
    }

    function createMarkersTable(markers) {
      let markerRows = "";
      _.each(markers, (marker) => {
        markerRows += `<tr><td><img src='${marker.url}'></td><td>${marker.name}</td></tr>`;
      });

      return (
        "<table style='width: 100%; max-width: 300px;'><caption>Campaign Token Markers</caption><thead><tr><th>Image</th><th>Name</th></tr></thead><tbody>" +
        markerRows +
        "</tbody></table>"
      );
    }

    function createHelpTable() {
      const createModifiersList = (modifiers) => {
        let modifierItems = "";
        _.each(modifiers, (modifier) => {
          if (!_.isEmpty(modifier)) {
            modifierItems += `<li><span style="font-weight: bold;">${modifier.keyword}</span>: ${modifier.description}</li>`;
          }
        });

        if (modifierItems) {
          return (
            '<div><ul style="margin: 0px;">' + modifierItems + "</ul></div>"
          );
        }

        return "<div>No modifiers exist for this command.</div>";
      };

      let commandRows = "";
      _.each(COMMANDS_LIST, (command) => {
        commandRows += `<tr style="border-bottom: 1px solid black;"><td style="vertical-align: top; padding-right: 10px;">${
          command.keyword
        }</td><td style="vertical-align: top;">${
          command.description
        }<br/><br/>${createModifiersList(command.modifiers)}</td></tr>`;
      });

      return (
        "<table style='width: 100%; max-width: 500px;'><caption>ConditionTracker Commands</caption><thead><tr><th>Command</th><th>Description</th></tr></thead><tbody>" +
        commandRows +
        "</tbody></table>"
      );
    }

    function getConditionMarkers(conditionsArray) {
      const { conditions } = state.ConditionTracker;

      const validMarkerNames = _.map(conditions, (condition) => {
        if (conditionsArray.includes(condition.conditionName.toLowerCase())) {
          return condition.markerName;
        }
      });

      return validMarkerNames.filter((marker) => marker !== null);
    }

    function addCondition(commandOptions, chatMessage) {
      const conditionNames = commandOptions
        .replace(/,\s*/g, ",")
        .toLowerCase()
        .split(",");
      const markerNames = getConditionMarkers(conditionNames);

      _.each(chatMessage.selected, (selectedItem) => {
        const token = getObj(selectedItem._type, selectedItem._id);

        if (markerNames.length) {
          const currentMarkers = token
            .get("statusmarkers")
            .replace(/,\s*/g, ",")
            .split(",")
            .filter((marker) => marker !== "");

          token.set(
            "statusmarkers",
            [...currentMarkers, ...markerNames].join(",")
          );
        }

        const currentTooltip = token
          .get("tooltip")
          .replace(/,\s*/g, ",")
          .toLowerCase()
          .split(",");
        const addedTooltip = conditionNames.filter(
          (condition) => !currentTooltip.includes(condition)
        );

        token.set(
          "tooltip",
          [...currentTooltip, ...conditionNames]
            .filter((tooltipItem) => tooltipItem !== "")
            .sort()
            .map((tooltipItem) => capitalizeFirstLetter(tooltipItem))
            .join(", ")
        );
      });
    }

    function removeSingleConditionInstance(commandOptions, chatMessage) {
      const conditionNames = commandOptions
        .replace(/,\s*/g, ",")
        .toLowerCase()
        .split(",");
      const markerNames = getConditionMarkers(conditionNames);

      _.each(chatMessage.selected, (selectedItem) => {
        const token = getObj(selectedItem._type, selectedItem._id);

        if (markerNames.length) {
          let markersAfterSingleRemoval;
          const currentMarkers = token
            .get("statusmarkers")
            .replace(/,\s*/g, ",")
            .split(",")
            .filter((marker) => marker !== "");

          _.each(markerNames, (marker) => {
            const firstMarkerIndex = currentMarkers.indexOf(marker);

            if (firstMarkerIndex === -1) {
              return;
            } else if (firstMarkerIndex === 0) {
              markersAfterSingleRemoval = currentMarkers
                .slice(1)
                .filter((marker) => marker !== "");
            } else {
              markersAfterSingleRemoval = [
                ...currentMarkers.slice(0, firstMarkerIndex),
                ...currentMarkers.slice(firstMarkerIndex + 1),
              ].filter((marker) => marker !== "");
            }
          });

          if (markersAfterSingleRemoval) {
            token.set("statusmarkers", markersAfterSingleRemoval.join(","));
          }
        }

        let tooltipAfterSingleRemoval;
        const currentTooltip = token
          .get("tooltip")
          .replace(/,\s*/g, ",")
          .toLowerCase()
          .split(",");

        _.each(conditionNames, (condition) => {
          const firstConditionIndex = currentTooltip.indexOf(condition);

          if (firstConditionIndex === -1) {
            return;
          } else if (firstConditionIndex === 0) {
            tooltipAfterSingleRemoval = currentTooltip
              .slice(1)
              .filter((tooltipItem) => tooltipItem !== "");
          } else {
            tooltipAfterSingleRemoval = [
              ...currentTooltip.slice(0, firstMarkerIndex),
              ...currentTooltip.slice(firstMarkerIndex + 1),
            ].filter((tooltipItem) => tooltipItem !== "");
          }
        });

        token.set(
          "tooltip",
          tooltipAfterSingleRemoval
            ? tooltipAfterSingleRemoval
                .filter((tooltipItem) => tooltipItem !== "")
                .sort()
                .map((tooltipItem) => capitalizeFirstLetter(tooltipItem))
                .join(", ")
            : ""
        );
      });
    }

    function removeAllConditionInstances(commandOptions, chatMessage) {
      const conditionNames = commandOptions
        .replace(/,\s*/g, ",")
        .toLowerCase()
        .split(",");
      const markerNames = getConditionMarkers(conditionNames);

      _.each(chatMessage.selected, (selectedItem) => {
        const token = getObj(selectedItem._type, selectedItem._id);

        if (markerNames.length) {
          const markersAfterRemoveAll = token
            .get("statusmarkers")
            .replace(/,\s*/g, ",")
            .split(",")
            .filter((marker) => marker !== "" && !markerNames.includes(marker));

          token.set("statusmarkers", [...markersAfterRemoveAll].join(","));
        }

        const currentTooltip = token
          .get("tooltip")
          .replace(/,\s*/g, ",")
          .toLowerCase()
          .split(",");
        const tooltipAfterRemoveAll = currentTooltip.filter(
          (condition) => !conditionNames.includes(condition)
        );

        token.set(
          "tooltip",
          [...tooltipAfterRemoveAll]
            .filter((tooltipItem) => tooltipItem !== "")
            .sort()
            .map((tooltipItem) => capitalizeFirstLetter(tooltipItem))
            .join(", ")
        );
      });
    }

    function handleChatInput(message) {
      /**
       * Only want to handle commands that are prefaced with "!ct" to avoid
       * possibly running other similarly named commands from other scripts.
       */
      const initializer = message.content.split(/\s/, 1);
      if (initializer[0].toLowerCase() !== "!ct") {
        return;
      }

      const parameters = message.content
        .slice(message.content.indexOf(" ") + 1)
        .split("|");

      const command = parameters[0];
      let modifier;
      let options;

      if (parameters.length === 3) {
        modifier = parameters[1];
        options = parameters[2];
      } else {
        options = parameters[1];
      }

      let conditionNames;
      let markerNames;

      switch (command.toLowerCase()) {
        case COMMANDS_LIST.help.keyword:
          sendChat("ConditionTracker v" + VERSION, createHelpTable());
          break;
        case COMMANDS_LIST.campaignMarkers.keyword:
          sendChat(
            "player|" + message.playerid,
            createMarkersTable(campaignMarkers)
          );
          break;
        case COMMANDS_LIST.addCondition.keyword:
          if (!message.selected) {
            return;
          }

          addCondition(options, message);
          break;
        case COMMANDS_LIST.removeCondition.keyword:
          if (!message.selected) {
            return;
          }

          if (modifier === "single") {
            removeSingleConditionInstance(options, message);
          } else {
            removeAllConditionInstances(options, message);
          }
          break;
        // case "!cttoggle":
        //   if (!message.selected && message.selected[0]._type == "graphic")
        //     return;

        //   markerName = message.content.split(" ")[1].toLowerCase();
        //   obj = getObj(message.selected[0]._type, message.selected[0]._id);
        //   currentMarkers = obj.get("statusmarkers").split(",");

        //   if (currentMarkers.includes(markerName)) {
        //     const filteredMarkers = currentMarkers.filter((marker) => {
        //       return marker !== markerName && marker !== "";
        //     });
        //     obj.set("statusmarkers", filteredMarkers.join(","));
        //     obj.set(
        //       "tooltip",
        //       filteredMarkers
        //         .filter((marker) => !excludedMarkers.includes(marker))
        //         .sort()
        //         .join(", ")
        //     );
        //   } else {
        //     const newMarkers = [...currentMarkers, markerName].filter(
        //       (marker) => marker !== ""
        //     );
        //     obj.set("statusmarkers", newMarkers.join(","));
        //     obj.set(
        //       "tooltip",
        //       newMarkers
        //         .filter((marker) => !excludedMarkers.includes(marker))
        //         .sort()
        //         .join(", ")
        //     );
        //   }
        //   break;
        // case "!ctcharlist":
        //   if (!message.selected && message.selected[0]._type == "graphic")
        //     return;
        //   obj = getObj(message.selected[0]._type, message.selected[0]._id);
        //   currentMarkers = obj.get("statusmarkers");
        //   sendChat("Character Token Markers", currentMarkers);
        //   break;
        default:
          sendChat(
            "ConditionTracker",
            "Command not found. Send '!ct --help' in chat for a list of valid commands."
          );
          break;
      }
    }

    function capitalizeFirstLetter(sentence) {
      return sentence[0].toUpperCase() + sentence.slice(1);
    }

    function registerEventHandlers() {
      on("chat:message", handleChatInput);
    }

    return {
      CheckInstall: checkInstall,
      FetchCampaignMarkers: fetchCampaignMarkers,
      RegisterEventHandlers: registerEventHandlers,
    };
  })();

on("ready", () => {
  ConditionTracker.CheckInstall();
  ConditionTracker.FetchCampaignMarkers();
  ConditionTracker.RegisterEventHandlers();
});
