import https from "https";
import { spawn } from "child_process";
import { INotification } from "vortex-api/lib/types/INotification";
import { fs } from "vortex-api";
import path from "path";
import { IExtensionContext } from "vortex-api/lib/types/IExtensionContext";
import { IDiscoveryResult } from "vortex-api/lib/extensions/gamemode_management/types/IDiscoveryResult";

export const downloadWithProgress = async (
  url: string,
  progressCallback: (totalLength: number, currentLength: number) => void
): Promise<string> => {
  const resolvedUrl = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
  }).then((response) => {
    return response.url;
  });

  return new Promise((resolve, reject) => {
    https
      .request(resolvedUrl, (res) => {
        res.setEncoding("binary");
        const contentLength = parseInt(res.headers?.["content-length"], 10);

        let output = "";
        res
          .on("data", (data) => {
            output += data;
            if (output.length % 500 === 0) {
              progressCallback(contentLength, output.length);
            }
          })
          .on("end", () => {
            resolve(output);
          });
      })
      .on("error", (err) => reject(err))
      .end();
  });
};

export const runTool = async (
  path: string,
  args: string[]
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(path, args, {
      shell: false,
    });

    let stdOut = "";
    let stdErr = "";

    childProcess.stdout.on("data", (data) => {
      stdOut += data;
    });

    childProcess.stderr.on("data", (data) => {
      stdErr += data;
    });

    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve(stdOut);
      } else {
        reject({
          code,
          stdErr,
        });
      }
    });
  });
};

export const downloadMOMI = (
  context: IExtensionContext,
  discovery: IDiscoveryResult
) => {
  return () => {
    const downloadNotif: INotification = {
      id: "momi-download",
      type: "activity",
      title: "Downloading MOMI",
      message: "This may take a minute...",
    };

    context.api.dismissNotification("momi-missing");
    context.api.dismissNotification("momi-needs-update");

    const exe64 =
      "https://github.com/Garethp/Mods-of-Mistria-Installer/releases/latest/download/ModsOfMistriaInstaller-cli.exe";

    const exe86 =
      "https://github.com/Garethp/Mods-of-Mistria-Installer/releases/latest/download/ModsOfMistriaInstaller-cli.exe";

    context.api.sendNotification({
      ...downloadNotif,
      progress: 0,
    });

    const versionToUse =
      process.env.PROCESSOR_ARCHITECTURE !== "AMD64" ? exe86 : exe64;

    void downloadWithProgress(versionToUse, (total, current) => {
      context.api.sendNotification({
        ...downloadNotif,
        progress: (current / total) * 100,
      });
    }).then((output) => {
      context.api.sendNotification({
        ...downloadNotif,
        progress: 100,
      });
      context.api.dismissNotification("momi-download");
      context.api.sendNotification({
        id: "momi-downloaded",
        type: "success",
        message: "Download Complete",
      });

      return fs.writeFileAsync(
        path.join(discovery.path, "ModsOfMistriaInstaller-cli.exe"),
        output,
        { encoding: "binary" }
      );
    });
  };
};
