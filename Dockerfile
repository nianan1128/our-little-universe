FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY server/CoupleSpace.Server.csproj server/
COPY server/Program.cs server/
COPY index.html ./
COPY assets ./assets

RUN dotnet publish server/CoupleSpace.Server.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish ./

ENV DATA_DIR=/data
ENV PORT=8080
VOLUME ["/data"]
EXPOSE 8080

ENTRYPOINT ["dotnet", "CoupleSpace.Server.dll"]
