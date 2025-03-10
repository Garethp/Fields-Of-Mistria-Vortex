import https from "https";

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
