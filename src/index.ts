import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FlowController } from "./flow-controller.js";
import { BrowserManager } from "./browser.js";

// Initialize the Flow Controller
const controller = new FlowController();

// Create the MCP server instance
const server = new McpServer({
  name: "google-flow-mcp",
  version: "1.0.0",
});

// Tool 1: Check Google Flow session & login status
server.tool(
  "flow_status",
  "Check whether the Google Flow browser is open, logged in, and ready to generate media.",
  {},
  async () => {
    try {
      const status = await controller.checkSession();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Failed to check Google Flow status: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool 2: Get remaining credits from Google Flow
server.tool(
  "flow_get_credits",
  "Inspect the current Google Flow web interface to check remaining credits/quota.",
  {},
  async () => {
    try {
      const credits = await controller.getCredits();
      return {
        content: [
          {
            type: "text",
            text: `Current Credits: ${credits.credits} (${credits.rawText})`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Failed to get credits: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool 3: Generate Image on Google Flow
server.tool(
  "flow_generate_image",
  "Generates an image on Google Flow using a natural language prompt.",
  {
    prompt: z.string().describe("Detailed description of the image to generate"),
    aspectRatio: z
      .enum(["16:9", "1:1", "9:16"])
      .optional()
      .default("16:9")
      .describe("Aspect ratio for the generated image"),
  },
  async ({ prompt, aspectRatio }) => {
    try {
      const result = await controller.generateMedia({
        prompt,
        mediaType: "image",
        aspectRatio,
      });

      return {
        content: [
          {
            type: "text",
            text: `Image generated successfully!\nPrompt: "${result.prompt}"\nSaved to: ${result.outputPath}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error during image generation: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool 4: Generate Video on Google Flow (Veo)
server.tool(
  "flow_generate_video",
  "Generates a video on Google Flow using Veo with a text prompt.",
  {
    prompt: z.string().describe("Detailed description of the video motion and scene to generate"),
    aspectRatio: z
      .enum(["16:9", "9:16"])
      .optional()
      .default("16:9")
      .describe("Aspect ratio for the generated video"),
  },
  async ({ prompt, aspectRatio }) => {
    try {
      const result = await controller.generateMedia({
        prompt,
        mediaType: "video",
        aspectRatio,
      });

      return {
        content: [
          {
            type: "text",
            text: `Video generated successfully with Veo!\nPrompt: "${result.prompt}"\nSaved to: ${result.outputPath}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error during video generation: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool 5: Open/Show Google Flow in Browser
server.tool(
  "flow_open_browser",
  "Opens or focuses the Google Flow browser window for manual interaction or inspection.",
  {},
  async () => {
    try {
      await controller.ensurePage();
      return {
        content: [
          {
            type: "text",
            text: "Google Flow browser window is active and open.",
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Failed to open browser: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Graceful cleanup
process.on("SIGINT", async () => {
  console.error("[GoogleFlowMCP] Shutting down...");
  await BrowserManager.getInstance().close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("[GoogleFlowMCP] Terminating...");
  await BrowserManager.getInstance().close();
  process.exit(0);
});

// Start the server using stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[GoogleFlowMCP] Google Flow MCP Server running on stdio.");
