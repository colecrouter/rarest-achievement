import { SteamApp } from "@project/lib";
import { DeduplicationContext } from "./Context";

export class SteamAppContext extends DeduplicationContext<SteamApp, ConstructorParameters<typeof SteamApp>> {
    protected decodeValue(encoded: ConstructorParameters<typeof SteamApp>): SteamApp {
        return new SteamApp(...encoded);
    }
    protected encodeValue(value: SteamApp): ConstructorParameters<typeof SteamApp> {
        return value.serialize();
    }
}
