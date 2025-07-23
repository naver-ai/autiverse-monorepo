import { io, Socket } from "socket.io-client";
import { useEffect, } from "react";
import { Observable, Subject } from "rxjs";
import { WebsocketEvent } from "../types";

export class SocketManager {
  private static instance: SocketManager;
  private socket: Socket | null = null;
  
  
  private constructor() {
    return;
  }

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  private static type: "admin" | "dyad" = "dyad";

  private static protocol = "ws";

  private static socketUrl: string = ""

  private static verbose = true;

  private _eventSubject = new Subject<{ event: string; data: any }>();

  public get eventSubject$(): Observable<{ event: string; data: any }> {
    return this._eventSubject.asObservable();
  }

  private emitToHandlers(event: string, data?: any): void {
    this._eventSubject.next({ event, data });
  }

  public static init(protocol: "ws" | "wss", hostname: string, port: number, type: "admin" | "dyad", verbose: boolean = true): void {
    this.protocol = protocol;
    this.socketUrl = `${this.protocol}://${hostname}:${port}`;
    this.type = type;
    this.verbose = verbose;
  }

  public connect(token: string): void {
    if (this.socket?.connected) {
      console.log("Socket already connected, skipping connection");
      return;
    }

    // Get token from electron store
    if (!token) {
      console.error("No auth token available");
      return;
    }

    try{
        console.log("Connecting to socket:", SocketManager.socketUrl);

        this.socket = io(SocketManager.socketUrl, {
        auth: {
            token,
            type: SocketManager.type
        },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        path: "/socket.io",
        withCredentials: true,
        });

        this.setupEventListeners();
    }catch(ex){
        console.error("Error connecting to socket:", ex);
    }

  }

  private setupEventListeners(): void {
    if (!this.socket){
      console.error("Socket not connected, skipping event listeners setup");
      return;
    } 

    this.socket.removeAllListeners();

    this.socket.on("connect", () => {
      if (SocketManager.verbose) {
        console.log("Socket connected through an id: ", this.socket?.id);
      }
      this.emitToHandlers("onConnect");
    });

    this.socket.on("disconnect", () => {
      if (SocketManager.verbose) {
        console.log("Socket disconnected");
      }
      this.emitToHandlers("onDisconnect");
    });

    this.socket.on("connect_error", (error) => {
      console.error(error);
      this.emitToHandlers("onError", error);
    });

    this.socket.on("admin_connected", (data) => {
      if (SocketManager.verbose) {
        console.log("Admin connected", data);
      }
      this.emitToHandlers("onAdminConnected", data);
    });

    this.socket.on("admin_disconnected", (data) => {
      if (SocketManager.verbose) {
        console.log("Admin disconnected", data);
      }
      this.emitToHandlers("onAdminDisconnected", data);
    });

    this.socket.on(WebsocketEvent.ComicGenerationProgress, (data) => {
      console.log("Comic generation progress", data);
      this.emitToHandlers(WebsocketEvent.ComicGenerationProgress, data);
    });

    this.socket.on(WebsocketEvent.ComicGenerationCompleted, (data) => {
      console.log("Comic generation completed", data);
      this.emitToHandlers(WebsocketEvent.ComicGenerationCompleted, data);
    });
  }

  public disconnect(): void {
    if (this.socket?.connected) {
      this.socket.disconnect();
    }

    this.socket = null;
  }

  public isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Create singleton instance
const socketManager = SocketManager.getInstance();

// React hook to use the socket manager
export function useSocket(token: string|undefined|null) {
  useEffect(() => {
    // Connect if not already connected
    if(token){
      socketManager.connect(token);
    }else{
      socketManager.disconnect();
    }

    // Cleanup에서는 disconnect하지 않음 (다른 컴포넌트에서 사용할 수 있으므로)
    // return () => {
    //   socketManager.disconnect();
    // };
  }, [token]);

  return {
    isConnected: socketManager.isConnected(),
    eventSubject$: socketManager.eventSubject$
  };
}
