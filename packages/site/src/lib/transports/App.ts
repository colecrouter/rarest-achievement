import { SteamApp } from "@project/lib";
import { DeduplicationContext } from "./Context";

export class SteamAppContext extends DeduplicationContext<
    SteamApp,
    [number, ConstructorParameters<typeof SteamApp>[0]]
> {
    protected decodeValue(encoded: [number, ConstructorParameters<typeof SteamApp>[0]]): SteamApp {
        return new SteamApp(encoded[1]);
    }
    protected encodeValue(value: SteamApp): [number, ConstructorParameters<typeof SteamApp>[0]] {
        return [value.id, value.serialize()];
    }
}
