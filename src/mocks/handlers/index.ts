import { auctionHandlers } from "./auctions";
import { authHandlers } from "./auth";
import { chatHandlers } from "./chat";
import { imageHandlers } from "./images";
import { miscHandlers } from "./misc";
import { notificationHandlers } from "./notifications";
import { purchaseHandlers } from "./purchases";
import { reviewHandlers } from "./reviews";
import { userHandlers } from "./users";

export const handlers = [
  ...authHandlers,
  ...userHandlers,
  ...auctionHandlers,
  ...notificationHandlers,
  ...chatHandlers,
  ...imageHandlers,
  ...purchaseHandlers,
  ...reviewHandlers,
  ...miscHandlers,
];
