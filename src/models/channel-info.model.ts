export interface Playlist {
  name: string;
  link: string;
}

export interface ChannelInfo {
  id: string;
  profileName: string; // User-facing name for this configuration
  channelName: string;
  channelLink: string;
  spotifyLink?: string;
  contactEmail?: string;
  playlists?: Playlist[];
  shortDescription?: string;
  channelTags?: string;
}