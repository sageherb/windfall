// src/mocks/types.ts

// Mirror of backend AuctionStatus enum
export type AuctionStatus = "SCHEDULED" | "PROCESS" | "COMPLETED" | "CANCELED";

// Mirror of backend AuctionCategory enum
export type AuctionCategory =
  | "CLOTHING"
  | "GOODS"
  | "FURNITURE_INTERIOR"
  | "DIGITAL"
  | "APPLIANCE"
  | "SPORTS_LEISURE"
  | "PET"
  | "HOBBY"
  | "BOOK_TICKET"
  | "ETC";

// Mirror of backend ApiResponse<T>
export interface ApiResponse<T> {
  code: number;
  status: string;
  message: string;
  data: T;
}

// Mirror of backend SliceResponse<T>
export interface SliceResponse<T> {
  slice: T[];
  hasNext: boolean;
  page: number;
  size: number;
  timeStamp: string;
}

// Mirror of backend CursorResponse<T>
export interface CursorResponse<T> {
  content: T[];
  nextCursor: number | null;
  hasNext: boolean;
  size: number;
  timeStamp: string;
}

// Mirror of backend SellerInfo (subset used by frontend)
export interface SellerInfo {
  sellerId: number;
  name: string;
  profileImage: string | null;
  rating: number;
  totalReviews: number;
}

// Stored shape — currentPrice/discountRate are NOT stored; computed at response time.
export interface AuctionRecord {
  auctionId: number;
  title: string;
  description: string;
  category: AuctionCategory;
  imageUrls: string[]; // first is thumbnail
  sellerId: number;
  startPrice: number;
  dropAmount: number;
  stopLoss: number;
  status: AuctionStatus;
  startedAt: string; // ISO
  createdDate: string; // ISO
  tags: string[];
  likeCount: number;
}

// Mirror of frontend NotificationItem
export interface NotificationRecord {
  notificationId: number;
  type: string;
  title: string;
  message: string;
  readStatus: boolean;
  target: "chatRoom" | "auction" | "payment" | "review" | string;
  targetId: number;
  notificationAt: string;
}

export interface UserRecord {
  userId: number;
  username: string;
  userEmail: string;
  userProfileUrl: string;
  rating: number;
  totalReviews: number;
}

export interface ChatRoomRecord {
  chatRoomId: number;
  tradeId: number;
  auctionId: number;
  otherUserId: number;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface ChatMessageRecord {
  messageId: number;
  chatRoomId: number;
  senderId: number;
  messageType: "TEXT" | "IMAGE";
  content: string;
  imageUrls: string[] | null;
  createdAt: string;
  isRead: boolean;
}

export interface PurchaseRecord {
  tradeId: number;
  auctionId: number;
  buyerId: number;
  sellerId: number;
  finalPrice: number;
  status: "PENDING" | "CONFIRMED" | "CANCELED";
  purchasedAt: string;
}

export interface ReviewRecord {
  reviewId: number;
  reviewerId: number;
  revieweeId: number;
  auctionId: number;
  rating: number;
  content: string;
  createdAt: string;
}
