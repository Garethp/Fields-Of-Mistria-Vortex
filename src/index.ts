import { IExtensionContext } from "vortex-api/lib/types/IExtensionContext";
import { fs, util } from "vortex-api";
import { IDiscoveryResult } from "vortex-api/lib/extensions/gamemode_management/types/IDiscoveryResult";
import * as path from "path";
import { downloadMOMI, runTool } from "./utils";
import semver from "semver/preload";

const GAME_ID = "fieldsofmistria";
const STEAMAPP_ID = "2142790";

const getPathExistsAsync = async (path) => {
  try {
    await fs.statAsync(path);
    return true;
  } catch (err) {
    return false;
  }
};

const findGame = () => {
  return util.GameStoreHelper.findByAppId([STEAMAPP_ID]).then(
    (game) => game.gamePath,
  );
};

const init = (context: IExtensionContext) => {
  const prepareForModding = async (discovery: IDiscoveryResult) => {
    fs.ensureDirAsync(path.join(discovery.path, "mods"));

    const installerPath = path.join(
      discovery.path,
      "ModsOfMistriaInstaller-cli.exe",
    );

    const installerFound = await getPathExistsAsync(installerPath);

    let online = true;
    const currentVersion = await fetch(
      "https://api.github.com/repos/Garethp/Mods-of-Mistria-Installer/releases/latest",
    )
      .then((response) => response.json())
      .then((data) => data.tag_name.replace(/^v/, ""))
      .catch(() => (online = false));

    console.log({ online, currentVersion });

    if (installerFound) {
      if (!online) return;

      const version = await runTool(installerPath, ["--version"]).catch((e) => {
        console.log(e);
        return "0.0.0";
      });

      if (semver.lt(version, currentVersion)) {
        context.api.sendNotification({
          id: "momi-needs-update",
          type: "warning",
          title: "Mods of Mistria Installer has an update to install",
          message:
            "The Mods of Mistria Installer currently installed is out of date. Please download the latest version.",
          actions: !online
            ? []
            : [
                {
                  title: "Download",
                  action: downloadMOMI(context, discovery),
                },
              ],
        });
      }
      return;
    }

    context.api.sendNotification({
      id: "momi-missing",
      type: "error",
      title: "Mods of Mistria Installer not found",
      message:
        "The Mods of Mistria Installer was not found in the game directory.",
      actions: !online
        ? []
        : [
            {
              title: "Download",
              action: downloadMOMI(context, discovery),
            },
          ],
    });
  };

  context.registerGame({
    id: GAME_ID,
    name: "Fields of Mistria",
    mergeMods: false,
    queryPath: findGame,
    supportedTools: [
      {
        id: "MOMI",
        name: "Mods of Mistria Installer",
        requiredFiles: ["ModsOfMistriaInstaller-cli.exe"],
        executable: () => "ModsOfMistriaInstaller-cli.exe",
        relative: true,
        shell: false,
        environment: {
          EXIT_ON_COMPLETE: "true",
        },
      },
    ],
    queryModPath: () => "mods",
    logo: "fields-of-mistria.png",
    executable: () => "FieldsOfMistria.exe",
    requiredFiles: ["FieldsOfMistria.exe"],
    setup: prepareForModding,
    environment: {
      SteamAPPId: STEAMAPP_ID,
    },
    details: {
      steamAppId: STEAMAPP_ID,
    },
  });

  context.once(() => {
    context.api.onAsync("did-deploy", async (...args) => {
      console.log("Deployment", args);

      const state = context.api.store.getState();
      const tool = util.getSafe(
        state,
        ["settings", "gameMode", "discovered", GAME_ID, "tools", "MOMI"],
        undefined,
      );

      if (!tool) {
        context.api.sendNotification({
          id: "momi-missing",
          type: "error",
          title: "Mods of Mistria Installer not found",
          message:
            "The Mods of Mistria Installer was not found in the game directory.",
        });

        return;
      }

      return context.api
        .runExecutable(tool.path, [], {
          shell: tool.shell,
          env: tool.environment,
        })
        .catch((err) =>
          context.api.showErrorNotification("Failed to run tool", err, {
            allowReport:
              ["EPERM", "EACCESS", "ENOENT"].indexOf(err.code) !== -1,
          }),
        );
    });
  });

  return true;
};

module.exports = { default: init };
